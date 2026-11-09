require('regenerator-runtime/runtime');
const fs=require('fs/promises'),path=require('path');
const {PDFDocument,StandardFonts,rgb,degrees}=require('pdf-lib'),fontkit=require('@pdf-lib/fontkit');
const sections=require('../config/kycFields.json'),Document=require('../models/KycDocument'),{decrypt}=require('../utils/kycCrypto');
const clean=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
const labels={PHOTO:'Customer photograph',IDENTITY:'Identity proof',ADDRESS:'Address proof',BUSINESS:'Business proof',INCOME:'Income proof',SIGNATURE:'Customer signature'};
const A4=[595.28,841.89],LEFT=28,WIDTH=539.28,BOTTOM=65;
const stamp=v=>v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'Not recorded';
// Callers resolve ownership first. Load only the selected version's private documents.
async function generate(application){
 if(application.approval?.signedPdfEncrypted)return decrypt(application.approval.signedPdfEncrypted);
 const {lead,data,documentIds=[],submittedAt,version,label}=application;
 const signatures=await require('./kycSignature.service').evidence(application);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);pdf.setTitle('Royal Enterprises - Customer Loan Application');pdf.setAuthor('Royal Enterprises');
 const font=await pdf.embedFont(await fs.readFile(path.join(__dirname,'../../assets/fonts/NotoSansDevanagari.ttf')),{subset:true}),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const logo=await pdf.embedPng(await fs.readFile(path.join(__dirname,'../../assets/royal-enterprises-emblem.png')));
 const serif=await pdf.embedFont(StandardFonts.TimesRomanBold),italic=await pdf.embedFont(StandardFonts.TimesRomanItalic);
 const found=await Document.find({_id:{$in:documentIds},leadId:lead._id}).select('+encryptedBytes');
 // Preserve snapshot order; never substitute a current draft attachment.
 const docs=documentIds.map(id=>found.find(doc=>String(doc._id)===String(id))).filter(Boolean);
 const black=rgb(0,0,0),ink=rgb(.08,.09,.08),gold=rgb(.58,.42,.10),line=rgb(.78,.79,.77),white=rgb(1,1,1),cream=rgb(.988,.973,.929),dark=rgb(.035,.04,.045),brightGold=rgb(.83,.686,.216),embedded=new Map();let page,y,bodyWidth=WIDTH;
 function text(v,x,top,size=9,face=font,color=black){page.drawText(clean(v),{x,y:top-size,size,font:face,color});}
 function wrap(value,width,size=9,face=font){
  const out=[];
  for(const paragraph of clean(value===''||value==null?'N/A':value).split(/\r?\n/)){
   let current='';
   for(const word of paragraph.split(/\s+/)){
    const candidate=current?current+' '+word:word;
    if(face.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}
    if(current){out.push(current);current='';}
    for(const {segment}of new Intl.Segmenter('hi',{granularity:'grapheme'}).segment(word)){
     if(current&&face.widthOfTextAtSize(current+segment,size)>width){out.push(current);current='';}current+=segment;
    }
   }out.push(current);
  }return out;
 }
 function rect(x,top,w,h){page.drawRectangle({x,y:top-h,width:w,height:h,borderColor:line,borderWidth:.5,color:white});}
 function icon(kind,x,top,size=14,color=gold){
  const stroke=(x1,y1,x2,y2)=>page.drawLine({start:{x:x+x1*size,y:top-y1*size},end:{x:x+x2*size,y:top-y2*size},thickness:.9,color});
  const box=(a,b,w,h)=>page.drawRectangle({x:x+a*size,y:top-(b+h)*size,width:w*size,height:h*size,borderColor:color,borderWidth:.9});
  if(kind==='person'){page.drawCircle({x:x+size*.5,y:top-size*.23,size:size*.19,borderColor:color,borderWidth:.9});stroke(.15,.95,.15,.7);stroke(.15,.7,.35,.55);stroke(.35,.55,.65,.55);stroke(.65,.55,.85,.7);stroke(.85,.7,.85,.95);}
  else if(kind==='home'){stroke(.05,.4,.5,.05);stroke(.5,.05,.95,.4);stroke(.17,.33,.17,.93);stroke(.17,.93,.83,.93);stroke(.83,.93,.83,.33);box(.4,.55,.2,.38);}
  else if(kind==='calendar'){box(.08,.15,.84,.78);stroke(.08,.4,.92,.4);stroke(.3,0,.3,.28);stroke(.7,0,.7,.28);box(.26,.55,.12,.12);box(.6,.55,.12,.12);}
  else if(kind==='camera'){box(.05,.2,.9,.7);box(.32,.05,.36,.15);page.drawCircle({x:x+size*.5,y:top-size*.55,size:size*.2,borderColor:color,borderWidth:.9});}
  else if(kind==='layers'){for(const d of [0,.27,.54]){stroke(.08,.2+d,.5,.02+d);stroke(.5,.02+d,.92,.2+d);stroke(.92,.2+d,.5,.38+d);stroke(.5,.38+d,.08,.2+d);}}
  else {box(.15,.04,.7,.92);for(const d of [.28,.5,.72])stroke(.32,d,.72,d);}
 }
 function newPage(first=false){
  page=pdf.addPage(A4);
  // Local original lion-and-crown artwork; a single wordmark/tagline, no remote Stitch assets.
  page.drawRectangle({x:LEFT,y:757,width:WIDTH,height:70,color:dark});
  const fit=logo.scaleToFit(66,55);page.drawImage(logo,{x:LEFT+9,y:764+(55-fit.height)/2,...fit});
  page.drawLine({start:{x:108,y:771},end:{x:108,y:816},thickness:.6,color:brightGold});
  text('ROYAL ENTERPRISES',119,815,17,serif,brightGold);
  text('A Tradition of TRUST',119,792,10,italic,cream);
  page.drawRectangle({x:368,y:784,width:187,height:28,borderColor:brightGold,borderWidth:.8,color:dark});
  icon('document',377,804,13,brightGold);text('Customer Loan Application',397,804,9,bold,white);
  page.drawSvgPath('M 8 0 L 156 0 L 148 16 L 0 16 Z',{x:393,y:779,color:brightGold});
  text('KYC & Loan Details',413,777,8,bold,ink);
  page.drawRectangle({x:LEFT,y:755,width:WIDTH,height:2,color:brightGold});
  // Keep audit context small and separate from form fields; no workflow/approval banner.
  const metadata='Application '+String(lead._id)+' | '+(version==null?'Version not recorded':'v'+version)+' | Submitted: '+stamp(submittedAt)+' (Asia/Kolkata)';
  const metaLines=wrap(metadata,WIDTH,6.8);metaLines.forEach((value,n)=>text(value,LEFT,742-n*9,6.8));
  y=724-(metaLines.length-1)*9;
  if(first){
   const provenance=wrap(label||'Current saved form - original submission snapshot unavailable',WIDTH,6.8);
   provenance.forEach((value,n)=>text(value,LEFT,y-n*9,6.8));y-=provenance.length*9+12;
  }else y-=9;

 }
 function need(h){if(y-h<BOTTOM)newPage();}
 function heading(title,following=33){need(26+following);page.drawRectangle({x:LEFT,y:y-23,width:bodyWidth,height:23,color:rgb(.22,.145,.032)});page.drawRectangle({x:LEFT,y:y-23,width:3,height:23,color:brightGold});icon(/Personal|References/.test(title)?'person':/Address/.test(title)?'home':'document',LEFT+10,y-5,13,brightGold);text(title.toUpperCase(),LEFT+31,y-6,8.6,bold,white);y-=26;}
 function row(fields){
  const width=bodyWidth/fields.length,lines=fields.map(([,v])=>wrap(v,width-34)),total=Math.max(...lines.map(v=>v.length)),height=Math.max(33,18+total*12);
  if(height<=620)need(height);let offset=0;
  while(offset<total){
   if(y-BOTTOM<33)newPage();
   const take=Math.min(total-offset,Math.max(1,Math.floor((y-BOTTOM-18)/12))),h=Math.max(33,18+take*12);
   fields.forEach(([title],i)=>{rect(LEFT+i*width,y,width,h);text(title.toUpperCase()+(offset?' (CONTINUED)':''),LEFT+i*width+9,y-5,7.4,bold,black);lines[i].slice(offset,offset+take).forEach((v,n)=>text(v,LEFT+i*width+9,y-16-n*12,9));});
   y-=h;offset+=take;if(offset<total)newPage();
  }
 }
 async function image(doc){
  const id=String(doc._id);if(!embedded.has(id)){const bytes=decrypt(doc.encryptedBytes);embedded.set(id,doc.mime==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes));}return embedded.get(id);
 }
 async function imageBox(doc,x,top,w,h,caption){
  rect(x,top,w,h);
  if(doc){const picture=await image(doc),fit=picture.scaleToFit(w-12,h-24);page.drawImage(picture,{x:x+(w-fit.width)/2,y:top-h+18+(h-24-fit.height)/2,...fit});}
  else text('Not provided',x+8,top-18,8);
  text(caption,x+6,top-h+13,7.5,bold);
 }
 newPage(true);
 let sectionNumber=0;
 const displayDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value))&&Number.isFinite(new Date(value).getTime())?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):value;
 for(const section of sections){
  if(section.title==='Customer Declaration and Signature')continue;
  sectionNumber++;const personal=sectionNumber===1;let photoTop;bodyWidth=personal?390:WIDTH;
  // Keep ordinary sections together; exceptionally long answers still paginate.
  let sectionHeight=26+10,pending=[];
  const measure=fields=>Math.max(33,18+Math.max(...fields.map(([key])=>wrap(data[key],bodyWidth/fields.length-34).length))*12);
  for(const field of section.fields){if(field[2]==='textarea'){if(pending.length){sectionHeight+=measure(pending);pending=[];}sectionHeight+=measure([field]);}else{pending.push(field);if(pending.length===2){sectionHeight+=measure(pending);pending=[];}}}
  if(pending.length)sectionHeight+=measure(pending);
  if(sectionHeight<=662)need(sectionHeight);
  const first=section.fields[0],initialHeight=first?.[2]==='textarea'?Math.max(33,18+wrap(data[first[0]],WIDTH-16).length*12):33;
  heading(sectionNumber+'. '+section.title,Math.min(initialHeight,100),personal);photoTop=y+26;
  if(personal){
   const photoWidth=WIDTH-404,photoHeight=Math.max(158,Math.min(sectionHeight-10,220)),x=LEFT+404,doc=docs.find(d=>d.kind==='PHOTO');
   rect(x,photoTop,photoWidth,photoHeight);
   if(doc){const picture=await image(doc),fit=picture.scaleToFit(photoWidth-2,photoHeight-2);page.drawImage(picture,{x:x+(photoWidth-fit.width)/2,y:photoTop-photoHeight+(photoHeight-fit.height)/2,...fit});}
   else text('Photo not provided',x+9,photoTop-18,8);
  }
  let pair=[];
  for(const [key,title,type]of section.fields){
   const field=[key==='requestedAmount'?'Requested loan amount':title,type==='date'?displayDate(data[key]):data[key]];
   if(type==='textarea'){if(pair.length){row(pair);pair=[];}row([field]);}else{pair.push(field);if(pair.length===2){row(pair);pair=[];}}
  }if(pair.length)row(pair);
  bodyWidth=WIDTH;y-=12;
 }
 heading('11. Customer declaration and signature',160);
 row([['Declaration','I hereby declare that the information provided above is true and correct to the best of my knowledge.']]);
 row([['Declaration confirmed',data.declarationAccepted===true?'Yes':data.declarationAccepted===false?'No':'N/A'],['Declaration date',displayDate(data.declarationDate)]]);
 row([['Customer signature / full name',data.signatureName]]);
 heading('Verification and approval record',210);
 row([['KYC reference',String(lead._id)],['Final status',application.approval?'APPROVED':application.revisionId?'No final signed approval record':'Current saved version - no signed approval']]);
 if(application.approval)row([['Approval record',String(application.approval._id)],['Approved revision',version==null?'Not recorded':String(version)]]);
 need(174);
 const signatureWidth=(WIDTH-16)/3,signatureTop=y;
 const signatureCells=[
  {doc:docs.find(d=>d.kind==='SIGNATURE'),caption:'Customer signature',lines:[data.signatureName||'Name not recorded']},
  {doc:signatures.employee,caption:'Employee verification',lines:[signatures.employee?.name||'Not recorded',signatures.employee?.employeeCode||'Employee ID not recorded',stamp(signatures.employee?.signedAt)]},
  {doc:signatures.admin,caption:'Office authorized signature',lines:[signatures.admin?.name||'Awaiting Admin approval',signatures.admin?'Role: ADMIN':'No Admin signature',stamp(application.approval?.approvedAt)]}
 ];
 for(let i=0;i<signatureCells.length;i++){
  const cell=signatureCells[i],x=LEFT+i*(signatureWidth+8);
  rect(x,signatureTop,signatureWidth,166);
  text(cell.caption,x+6,signatureTop-6,7.8,bold);
  let top=signatureTop-22;
  for(const value of cell.lines){for(const line of wrap(value,signatureWidth-12,7.2)){text(line,x+6,top,7.2);top-=10;}}
  if(cell.doc){const picture=await image(cell.doc),fit=picture.scaleToFit(signatureWidth-12,74);page.drawImage(picture,{x:x+(signatureWidth-fit.width)/2,y:signatureTop-154+(74-fit.height)/2,...fit});}
  else text('Signature not recorded',x+6,signatureTop-112,7.5);
 }
 y=signatureTop-178;
 if(application.approval)row([['Assigned employee',application.approval.assignedEmployeeName+' ('+(application.approval.assignedEmployeeCode||'ID not recorded')+')'],['Approval date / time (Asia/Kolkata)',stamp(application.approval.approvedAt)]]);
 row([['Office verification / signature (additional manual verification)',' ']]);
 need(28);text('Electronic signature images with authenticated approval audit. No certificate-based digital signature is claimed.',LEFT,y-6,7);y-=28;
 if(docs.length<documentIds.length){need(45);row([['Unavailable attachments',(documentIds.length-docs.length)+' selected attachment(s) could not be retrieved. No substitute has been used.']]);}
 // Embed source PDF artwork, without copying source links/scripts/actions/annotations.
 const proofs=docs.filter(doc=>!['PHOTO','SIGNATURE'].includes(doc.kind));
 for(let index=0;index<proofs.length;index++){
  const doc=proofs[index];
  if(doc.mime==='application/pdf'){
   const source=await PDFDocument.load(decrypt(doc.encryptedBytes));
   for(let i=0;i<source.getPageCount();i++){
    newPage();heading(labels[doc.kind]+' | Document page '+(i+1)+' of '+source.getPageCount());
    const sourcePage=source.getPage(i);
    // Label genuinely blank uploaded pages explicitly; never invent replacement documents.
    rect(LEFT,y,WIDTH,y-BOTTOM);
    if(sourcePage.node.Contents()){
     const embeddedPage=await pdf.embedPage(sourcePage),rotation=((sourcePage.getRotation().angle%360)+360)%360,sideways=rotation===90||rotation===270;
     const w=sideways?embeddedPage.height:embeddedPage.width,h=sideways?embeddedPage.width:embeddedPage.height,scale=Math.min((WIDTH-16)/w,(y-BOTTOM-16)/h);
     const fit=embeddedPage.scale(scale),x=LEFT+(WIDTH-w*scale)/2,bottom=BOTTOM+8+(y-BOTTOM-16-h*scale)/2;
     page.drawPage(embeddedPage,{x:x+(rotation===180?fit.width:rotation===270?fit.height:0),y:bottom+(rotation===90?fit.width:rotation===180?fit.height:0),...fit,rotate:degrees(-rotation)});
    }else text('Uploaded PDF page is blank; no replacement content has been inserted.',LEFT+10,y-20,8);
   }
  }else{
   const picture=await image(doc),next=proofs[index+1];
   const nextPicture=next&&next.mime!=='application/pdf'?await image(next):null;
   newPage();
   // Pair wide proofs at a readable scale instead of wasting a whole A4 sheet.
   if(nextPicture&&new Set([doc.kind,next.kind]).has('BUSINESS')&&new Set([doc.kind,next.kind]).has('INCOME')&&picture.width/picture.height>=1.2&&nextPicture.width/nextPicture.height>=1.2){
    const height=(y-BOTTOM-52-8)/2;
    for(const item of [doc,next]){heading(labels[item.kind]);await imageBox(item,LEFT,y,WIDTH,height,labels[item.kind]);y-=height+8;}
    index++;
   }else{
    heading(labels[doc.kind]||'Uploaded document');
    await imageBox(doc,LEFT,y,WIDTH,Math.min(y-BOTTOM,picture.height*(WIDTH-12)/picture.width+24),labels[doc.kind]||'Uploaded document');
   }
  }
 }
 const pages=pdf.getPages();pages.forEach((p,i)=>{page=p;page.drawLine({start:{x:LEFT,y:49},end:{x:LEFT+WIDTH,y:49},thickness:1.3,color:brightGold});page.drawRectangle({x:LEFT,y:12,width:55,height:30,color:dark});const fit=logo.scaleToFit(47,25);page.drawImage(logo,{x:LEFT+4,y:14+(25-fit.height)/2,...fit});text('ROYAL ENTERPRISES',LEFT+69,34,8,bold);text('Confidential Customer Application',LEFT+69,25,7,font);text('Page '+(i+1)+' of '+pages.length,LEFT+WIDTH-55,30,8,bold);});
 return Buffer.from(await pdf.save());
}
module.exports={generate};
