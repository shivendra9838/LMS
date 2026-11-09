const { PDFDocument, decodePDFRawStream } = require('pdf-lib');
jest.mock('../../src/models/KycDocument', () => ({ find: jest.fn() }));
const Document = require('../../src/models/KycDocument');
const { generate } = require('../../src/services/kycApplicationPdf.service');
const { validateKyc } = require('../../src/validators/kyc.validator');
const fs=require('fs'),path=require('path');
const {encrypt}=require('../../src/utils/kycCrypto');

beforeEach(() => Document.find.mockReturnValue({ select: async () => [] }));
jest.setTimeout(30000);

test.each(['address','name'])('valid multiline %s paginates without placing text or the photo outside printable A4 pages', async (field) => {
  const value = Array.from({ length: field==='address'?100:50 }, (_, i) => field==='address'?`L${String(i).padStart(2, '0')}`:'L').join('\n');
  const data = validateKyc({ name: 'Synthetic pagination check', [field]:value });
  const bytes = await generate({ lead: { _id: 'synthetic-only' }, data, documentIds: [], version: 1, label: 'Saved draft' });
  const pdf = await PDFDocument.load(bytes);
  let textOperations = 0;
  for (const page of pdf.getPages()) {
    expect(page.getWidth()).toBeCloseTo(595.28);
    expect(page.getHeight()).toBeCloseTo(841.89);
    const streams = pdf.context.lookup(page.node.Contents()).asArray();
    for (const streamRef of streams) {
      const source = Buffer.from(decodePDFRawStream(pdf.context.lookup(streamRef)).decode()).toString();
      for (const match of source.matchAll(/1 0 0 1 [-\d.]+ ([-\d.]+) Tm/g)) {
        textOperations++;
        expect(Number(match[1])).toBeGreaterThanOrEqual(18);
        expect(Number(match[1])).toBeLessThanOrEqual(810);
      }
    }
  }
  expect(textOperations).toBeGreaterThan(100);
});

test('embeds all six encrypted image categories without replacing snapshot documents',async()=>{
  process.env.KYC_ENCRYPTION_KEY='31'.repeat(32);
  const kinds=['PHOTO','IDENTITY','ADDRESS','BUSINESS','INCOME','SIGNATURE'];
  const docs=kinds.map((kind,i)=>({_id:'doc-'+i,kind,mime:'image/png',encryptedBytes:encrypt(fs.readFileSync(path.join(__dirname,'../fixtures/kyc-documents',kind.toLowerCase()+'.png')))}));
  Document.find.mockReturnValue({select:async()=>[...docs].reverse()});
  const ids=docs.map(d=>d._id);
  const bytes=await generate({lead:{_id:'synthetic-version'},data:{name:'Synthetic application',signatureName:'Test signature'},documentIds:ids,version:3,label:'Submitted application',submittedAt:new Date('2026-10-01T10:00:00Z')});
  expect(Document.find).toHaveBeenCalledWith({_id:{$in:ids},leadId:'synthetic-version'});
  const pdf=await PDFDocument.load(bytes);
  const images=pdf.context.enumerateIndirectObjects().map(([,obj])=>obj).filter(obj=>obj.dict?.get(require('pdf-lib').PDFName.of('Subtype'))?.toString()==='/Image');
  expect(images).toHaveLength(7); // original logo plus all six selected images
  expect(pdf.getPages().every(p=>Math.abs(p.getWidth()-595.28)<.01&&Math.abs(p.getHeight()-841.89)<.01)).toBe(true);
  const dir=path.join(__dirname,'../../../tmp/pdfs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'all-image-application.pdf'),bytes);
});

test('embeds every source PDF page on labelled A4 sheets, retaining landscape content',async()=>{
  process.env.KYC_ENCRYPTION_KEY='31'.repeat(32);
  const source=await PDFDocument.create();
  source.addPage([900,400]).drawText('Synthetic landscape identity proof - every edge visible',{x:20,y:200,size:18});
  const rotated=source.addPage([400,900]);rotated.drawText('Synthetic second proof page',{x:20,y:450,size:18});rotated.setRotation(require('pdf-lib').degrees(90));
  Document.find.mockReturnValue({select:async()=>[{_id:'proof',kind:'IDENTITY',mime:'application/pdf',encryptedBytes:encrypt(Buffer.from(await source.save()))}]});
  const bytes=await generate({lead:{_id:'synthetic-pdf'},data:{},documentIds:['proof'],label:'Saved draft'});
  const pdf=await PDFDocument.load(bytes);
  const forms=pdf.context.enumerateIndirectObjects().map(([,obj])=>obj).filter(obj=>obj.dict?.get(require('pdf-lib').PDFName.of('Subtype'))?.toString()==='/Form');
  expect(forms).toHaveLength(2);
  for(const p of pdf.getPages()){expect(p.getWidth()).toBeCloseTo(595.28);expect(p.getHeight()).toBeCloseTo(841.89);}
  fs.writeFileSync(path.join(__dirname,'../../../tmp/pdfs/multipage-proof-application.pdf'),bytes);
});

test('fails closed on undecryptable private attachment bytes',async()=>{
  process.env.KYC_ENCRYPTION_KEY='31'.repeat(32);
  Document.find.mockReturnValue({select:async()=>[{_id:'bad',kind:'PHOTO',mime:'image/png',encryptedBytes:Buffer.from('invalid')}]});
  await expect(generate({lead:{_id:'synthetic'},data:{},documentIds:['bad']})).rejects.toThrow();
});

function drawnContent(pdf){
 return pdf.getPages().flatMap(page=>pdf.context.lookup(page.node.Contents()).asArray().map(ref=>Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString())).join('\n');
}
const latinHex=value=>Buffer.from(value,'ascii').toString('hex').toUpperCase();
test('Stitch adaptation retains all form sections without workflow banners, a document checklist or invented credentials',async()=>{
 const application={lead:{_id:'synthetic-design',status:'PENDING'},data:{name:'Synthetic only',signatureName:'Synthetic signature'},documentIds:[],version:0,label:'Current saved form - original submission snapshot unavailable'};
 const before=JSON.stringify(application),pdf=await PDFDocument.load(await generate(application)),content=drawnContent(pdf);
 expect(JSON.stringify(application)).toBe(before);
 const sections=require('../../src/config/kycFields.json');
 for(const [i,section] of sections.entries())expect(content).toContain(latinHex((i+1)+'. '+section.title.toUpperCase()));
 expect(content).toContain(latinHex('Customer Loan Application'));
 expect(content).not.toContain(latinHex('Current KYC workflow:'));
 expect(content).not.toContain(latinHex('Customer photograph'));
 expect(content).not.toContain(latinHex('Uploaded photograph'));
 const textBlocks=[...content.matchAll(/BT([\s\S]*?)ET/g)].map(match=>match[1]);
 for(const label of ['FULL NAME',"FATHER'S NAME",'PRIMARY MOBILE NUMBER','BANK NAME','REQUESTED LOAN AMOUNT']){
  const block=textBlocks.find(block=>block.includes('<'+latinHex(label)+'>'));expect(block).toBeDefined();expect(block).toMatch(/0 0 0 rg/);
 }

 for(const fabricated of ['DOCUMENT DETAILS','Document details','ATTACHMENT SCHEDULE','Tamper Evident','DIGI-SIGNED','OFFICIALLY VERIFIED','Bank certificate','CIBIL'])expect(content).not.toContain(latinHex(fabricated));
});

test('blank uploaded PDF pages retain no fabricated artwork or unsupported verification claim',async()=>{
 process.env.KYC_ENCRYPTION_KEY='31'.repeat(32);
 const source=await PDFDocument.create();source.addPage([595,842]);
 Document.find.mockReturnValue({select:async()=>[{_id:'blank-proof',kind:'ADDRESS',mime:'application/pdf',encryptedBytes:encrypt(Buffer.from(await source.save()))}]});
 const pdf=await PDFDocument.load(await generate({lead:{_id:'synthetic-blank',status:'OFFICIALLY VERIFIED'},data:{},documentIds:['blank-proof']}));
 const content=drawnContent(pdf);expect(content).not.toContain(latinHex('OFFICIALLY VERIFIED'));
 const forms=pdf.context.enumerateIndirectObjects().filter(([,obj])=>obj.dict?.get(require('pdf-lib').PDFName.of('Subtype'))?.toString()==='/Form');expect(forms).toHaveLength(0);
});
