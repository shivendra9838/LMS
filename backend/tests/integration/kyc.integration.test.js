const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { generateToken } = require('../../src/utils/jwt');

jest.mock('../../src/utils/cache', () => ({ getCache: jest.fn().mockResolvedValue(null), setCache: jest.fn(), invalidateCache: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ logAccess: jest.fn(), logError: jest.fn(), accessLoggerMiddleware: (req,res,next) => next() }));
const app = require('../../src/app');
const Employee = require('../../src/models/Employee');
const Admin = require('../../src/models/Admin');
const Customer = require('../../src/models/Customer');
const Lead = require('../../src/models/CustomerLead');
const Document = require('../../src/models/KycDocument');
const AuditLog = require('../../src/models/AuditLog');
const Loan = require('../../src/models/Loan');
const LoanSchedule = require('../../src/models/LoanSchedule');
const Collection = require('../../src/models/Collection');
const CashBook = require('../../src/models/CashBook');

jest.setTimeout(180000);
const complete = {
  name:'KYC Customer', fatherName:'पिता का नाम',dob:'1990-01-01',gender:'Male',nationality:'Indian',occupation:'Shop owner',maritalStatus:'Married',
  mobile:'9876543210',alternateMobile:'9876543211',email:'kyc@example.com',address:'123 Residential Road',city:'Mumbai',state:'Maharashtra',pin:'400001',area:'Central',
  businessAddress:'Shop 12 Market Road',businessCity:'Mumbai',businessState:'Maharashtra',businessPin:'400002',permanentAddress:'456 Family Road',permanentCity:'Pune',permanentState:'Maharashtra',permanentPin:'411001',
  ref1Name:'First Reference',ref1Mobile:'9876543212',ref2Name:'Second Reference',ref2Mobile:'9876543213',idProofType:'Aadhar',idProofNumber:'234567890123',addressProofType:'Electricity bill',addressProofNumber:'ADDR12345',
  bankName:'Example Bank',accountHolder:'KYC Customer',accountNumber:'123456789012',ifsc:'SBIN0001234',bankBranch:'Central Branch',vehicleType:'Motorcycle',vehicleNumber:'MH01AB1234',requestedAmount:'10000',loanPurpose:'Business stock',tenure:'100',signatureName:'KYC Customer',declarationDate:'2026-01-01',declarationAccepted:true
};
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const binary = (res, callback) => { const chunks=[]; res.on('data',chunk=>chunks.push(chunk)); res.on('end',()=>callback(null,Buffer.concat(chunks))); };
let repl, admin, employee, other, adminToken, token, otherToken, current, customerId;
const call = (method,url,auth=token) => request(app)[method](`/api/v1${url}`).set('Authorization',`Bearer ${auth}`);
const accept = (res,status=200) => { expect({status:res.status,body:res.body}).toMatchObject({status}); return res.body.data; };
async function create(data={}) { return accept(await call('post','/kyc').send({data}),201); }
async function upload(kind, bytes=image, mime='image/png', name='file.png') {
  current=accept(await call('post',`/kyc/${current._id}/documents`).field('kind',kind).field('version',String(current.version)).attach('file',bytes,{filename:name,contentType:mime}),201);
}

async function verification(record,auth=token){return accept(await call('post',`/kyc/${record._id}/verification-signatures`,auth).field('version',String(record.version)).attach('file',fs.readFileSync(path.join(__dirname,'../fixtures/kyc-documents/signature.png')),{filename:'signature.png',contentType:'image/png'}),201);}
async function submitSigned(record,auth=token){const signature=await verification(record,auth);return accept(await call('post',`/kyc/${record._id}/submit`,auth).send({version:record.version,signatureId:signature._id,confirmed:true}));}
async function approveSigned(record,employeeId,auth=adminToken){const signature=await verification(record,auth);return accept(await call('post',`/customer-leads/${record._id}/approve`,auth).send({version:record.version,employeeId:String(employeeId),signatureId:signature._id,confirmed:true}));}
beforeAll(async()=>{
  process.env.JWT_SECRET='isolated-kyc-test-secret'; process.env.KYC_ENCRYPTION_KEY='21'.repeat(32);
  repl=await MongoMemoryReplSet.create({replSet:{count:1},instanceOpts:[{storageEngine:'wiredTiger'}]});
  await mongoose.connect(repl.getUri(),{dbName:'lms_phase1_isolated_test'});
  await require('../../src/services/inbox.service').initialize();
  await Promise.all([Lead.init(),Customer.init(),Document.init(),Employee.init(),Loan.init(),LoanSchedule.init(),Collection.init(),CashBook.init()]);
  admin=await Admin.create({name:'Admin',email:'admin@kyc.test',password:'Secret123!',phone:'9876543200'});
  employee=await Employee.create({name:'Employee',employeeCode:'EMP0001',email:'employee@kyc.test',password:'Secret123!',phone:'9876543201',city:'Mumbai',area:'Central',createdBy:admin._id});
  other=await Employee.create({name:'Other',employeeCode:'EMP0002',email:'other@kyc.test',password:'Secret123!',phone:'9876543202',city:'Pune',area:'West',createdBy:admin._id});
  token=generateToken(String(employee._id),'EMPLOYEE'); otherToken=generateToken(String(other._id),'EMPLOYEE'); adminToken=generateToken(String(admin._id),'ADMIN');
});
afterAll(async()=>{ await mongoose.disconnect(); if(repl) await repl.stop(); });

describe('Database-backed KYC lifecycle',()=>{
  test('requires authentication and employee role for creating KYC',async()=>{
    expect((await request(app).post('/api/v1/kyc').send({data:{}})).status).toBe(401);
    expect((await call('post','/kyc',adminToken).send({data:{}})).status).toBe(403);
  });
  test('creates an incomplete draft and keeps it out of admin pending requests',async()=>{
    current=await create({name:'Draft Customer'});
    expect(current.status).toBe('DRAFT');
    const list=accept(await call('get','/customer-leads?status=PENDING',adminToken));
    expect(list.some(item=>item._id===current._id)).toBe(false);
  });
  test('searches and filters employee drafts without leaking to another employee',async()=>{
    const found=accept(await call('get','/customer-leads?status=DRAFT&search=Draft&kycOnly=true'));
    expect(found.map(item=>item._id)).toContain(current._id);
    expect(accept(await call('get','/customer-leads?status=DRAFT',otherToken))).toHaveLength(0);
  });
  test('blocks other employees through both KYC and existing lead routes',async()=>{
    expect((await call('get',`/kyc/${current._id}`,otherToken)).status).toBe(404);
    expect((await call('get',`/customer-leads/${current._id}`,otherToken)).status).toBe(404);
    expect((await call('put',`/kyc/${current._id}`,otherToken).send({data:complete,version:current.version})).status).toBe(404);
  });
  test('validates data and rejects stale concurrent saves',async()=>{
    expect((await call('put',`/kyc/${current._id}`).send({data:null,version:current.version})).status).toBe(422);
    expect((await call('put',`/kyc/${current._id}`).send({data:{name:{bad:true},dob:'2020-02-31',email:'bad',pin:'x',gender:'bad',maritalStatus:'bad',idProofType:'bad',accountNumber:'bad',ifsc:'bad',requestedAmount:'-1',tenure:'999999',declarationAccepted:'false'},version:current.version})).status).toBe(422);
    expect((await call('put',`/kyc/${current._id}`).send({data:{mobile:'bad'},version:current.version})).status).toBe(422);
    expect((await call('put',`/kyc/${current._id}`).send({data:{},version:999})).status).toBe(409);
    current=accept(await call('put',`/kyc/${current._id}`).send({data:complete,version:current.version}));
    expect(current.data.accountNumber).toBe(complete.accountNumber);
  });
  test('does not store plaintext identity/bank details or expose encrypted payloads through lists',async()=>{
    const raw=await Lead.collection.findOne({_id:new mongoose.Types.ObjectId(current._id)});
    expect(raw.kycEncrypted).toBeDefined();
    expect(JSON.stringify(raw)).not.toContain(complete.idProofNumber);
    expect(JSON.stringify(raw)).not.toContain(complete.accountNumber);
    const list=accept(await call('get','/customer-leads?status=DRAFT'));
    expect(JSON.stringify(list)).not.toContain('kycEncrypted');
    expect(JSON.stringify(list)).not.toContain(complete.accountNumber);
  });
  test('blocks submission before required document uploads',async()=>{
    expect((await call('post',`/kyc/${current._id}/submit`).send({version:current.version})).status).toBe(422);
  });
  test('rejects disguised files, oversized uploads, active PDFs, and unauthorized uploads',async()=>{
    const disguised=await call('post',`/kyc/${current._id}/documents`).field('kind','IDENTITY').field('version',String(current.version)).attach('file',Buffer.from('<script>alert(1)</script>'),{filename:'fake.png',contentType:'image/png'});
    expect(disguised.status).toBe(422);
    const large=await call('post',`/kyc/${current._id}/documents`).field('kind','PHOTO').field('version',String(current.version)).attach('file',Buffer.alloc(2*1024*1024+1),{filename:'large.png',contentType:'image/png'});
    expect(large.status).toBe(422);
    const active=await PDFDocument.create(); active.addPage(); active.addJavaScript('bad','app.alert("unsafe")');
    const bad=await call('post',`/kyc/${current._id}/documents`).field('kind','IDENTITY').field('version',String(current.version)).attach('file',Buffer.from(await active.save()),{filename:'active.pdf',contentType:'application/pdf'});
    expect(bad.status).toBe(422);
    expect((await call('post',`/kyc/${current._id}/documents`,otherToken).attach('file',image,{filename:'photo.png',contentType:'image/png'})).status).toBe(404);
  });
  test('uploads encrypted photos, signature, address and identity documents',async()=>{
    await upload('PHOTO'); await upload('SIGNATURE'); await upload('ADDRESS');
    const identity=await PDFDocument.create(); identity.addPage();
    await upload('IDENTITY',Buffer.from(await identity.save()),'application/pdf','identity.pdf');
    expect(current.documents).toHaveLength(4);
    const doc=await Document.findOne({leadId:current._id}).select('+encryptedBytes');
    expect(Buffer.from(doc.encryptedBytes).equals(image)).toBe(false);
  });
  test('authenticated preview returns original bytes with no-store; other employee/public access fails',async()=>{
    const photo=current.documents.find(doc=>doc.kind==='PHOTO');
    const res=await call('get',`/kyc/${current._id}/documents/${photo._id}`).buffer(true).parse(binary);
    expect(res.status).toBe(200); expect(res.body).toEqual(image); expect(res.headers['cache-control']).toBe('no-store');
    expect((await call('get',`/kyc/${current._id}/documents/${photo._id}`,otherToken)).status).toBe(404);
    expect((await request(app).get(`/api/v1/kyc/${current._id}/documents/${photo._id}`)).status).toBe(401);
    expect((await call('get',`/kyc/${current._id}/documents/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });
  test('submits and synchronizes the existing admin approval queue; pending edits are locked',async()=>{
    current=await submitSigned(current);
    expect(current.status).toBe('PENDING');
    await require('../../src/services/inbox.service').processEvents();const notice=await require('../../src/models/UserNotification').findOne({recipientId:admin._id,kycRequestId:current._id,kind:'KYC_SUBMITTED'});expect(notice).toBeTruthy();expect(accept(await call('post','/notifications/inbox/'+notice._id+'/open',adminToken).send({})).path).toBe('/admin/customers/kyc/'+current._id);
    expect(accept(await call('get','/customer-leads?status=PENDING',adminToken)).map(item=>item._id)).toContain(current._id);
    expect((await call('put',`/kyc/${current._id}`).send({data:complete,version:current.version})).status).toBe(409);
  });
  test('admin can inspect full KYC and employee cannot approve or request corrections',async()=>{
    const view=accept(await call('get',`/kyc/${current._id}`,adminToken)); expect(view.data.idProofNumber).toBe(complete.idProofNumber);
    expect((await call('post',`/customer-leads/${current._id}/approve`).send({employeeId:String(employee._id),version:current.version})).status).toBe(403);
    expect((await call('post',`/customer-leads/${current._id}/corrections`).send({adminRemarks:'Fix',version:current.version})).status).toBe(403);
  });
  test('requires correction reason, returns KYC, and lets the employee correct and resubmit',async()=>{
    expect((await call('post',`/customer-leads/${current._id}/corrections`,adminToken).send({version:current.version})).status).toBe(422);
    current=accept(await call('post',`/customer-leads/${current._id}/corrections`,adminToken).send({version:current.version,adminRemarks:'Confirm address'}));
    expect(current.status).toBe('CORRECTION_REQUIRED');
    current=accept(await call('put',`/kyc/${current._id}`).send({data:{...complete,address:'Corrected address'},version:current.version}));
    current=await submitSigned(current);
  });
  test('requires rejection reason and supports rejection followed by resubmission',async()=>{
    expect((await call('post',`/customer-leads/${current._id}/reject`,adminToken).send({version:current.version})).status).toBe(400);
    current=accept(await call('post',`/customer-leads/${current._id}/reject`,adminToken).send({version:current.version,adminRemarks:'Recheck identity'}));
    expect(current.status).toBe('REJECTED');
    current=await submitSigned(current);
  });
  test('approves atomically, links the same record to customer and masks legacy identity',async()=>{
    current=await approveSigned(current,employee._id);
    expect(current.status).toBe('APPROVED'); customerId=current.customerId;
    expect(accept(await call('get',`/customers/${customerId}`)).financialSummary).toMatchObject({kycStatus:'APPROVED',kycReviewStatus:'APPROVED',loanCount:0});
    await require('../../src/services/inbox.service').processEvents();const notice=await require('../../src/models/UserNotification').findOne({recipientId:employee._id,kycRequestId:current._id,kind:'KYC_APPROVED'});expect(notice).toBeTruthy();expect(accept(await call('post','/notifications/inbox/'+notice._id+'/open').send({})).path).toBe('/employee/customers/'+customerId);
    const customer=await Customer.findById(customerId);
    expect(String(customer.kycLeadId)).toBe(current._id); expect(customer.idProofNumber).toBe('********0123');
    expect(accept(await call('get',`/kyc/customer/${customerId}`))._id).toBe(current._id);
    expect(accept(await call('get',`/kyc/customer/${customerId}`,adminToken)).data).toEqual(current.data);
    expect((await call('post',`/customer-leads/${current._id}/approve`,adminToken).send({version:current.version,employeeId:String(employee._id)})).status).toBe(409);
  });
  test('protects approved changes from direct customer and KYC API bypass',async()=>{
    expect((await call('put',`/kyc/${current._id}`).send({data:{...complete,name:'Bypass'},version:current.version})).status).toBe(409);
    expect((await call('put',`/customers/${customerId}`).send({name:'Bypass'})).status).toBe(409);
  });
  test('keeps approved customer/snapshot unchanged while a revision is pending',async()=>{
    current=accept(await call('post',`/kyc/${current._id}/revise`).send({version:current.version}));
    const oldPhoto=current.documents.find(doc=>doc.kind==='PHOTO')._id;
    await upload('PHOTO');
    const oldPreview=await call('get',`/kyc/${current._id}/documents/${oldPhoto}`).buffer(true).parse(binary);expect(oldPreview.status).toBe(200);expect(oldPreview.body).toEqual(image);
    current=accept(await call('put',`/kyc/${current._id}`).send({data:{...complete,name:'Revised Customer'},version:current.version}));
    expect(current.approvedData.name).toBe('KYC Customer');
    expect((await Customer.findById(customerId)).name).toBe('KYC Customer');
    current=await submitSigned(current);
    expect(accept(await call('get',`/customers/${customerId}`)).financialSummary).toMatchObject({kycStatus:'APPROVED',kycReviewStatus:'PENDING'});
  });
  test('downloads complete reference-based PDF with readable fields and uploaded documents',async()=>{
    const res=await call('get',`/kyc/${current._id}/pdf`,adminToken).buffer(true).parse(binary);
    expect(res.status).toBe(200); expect(res.headers['content-type']).toContain('application/pdf'); expect(res.body.subarray(0,5).toString()).toBe('%PDF-');
    const pdf=await PDFDocument.load(res.body); expect(pdf.getPageCount()).toBeGreaterThanOrEqual(4);
    for(const page of pdf.getPages()){expect(page.getWidth()).toBeCloseTo(595.28);expect(page.getHeight()).toBeCloseTo(841.89);}
    const dir=path.join(__dirname,'../../../tmp/pdfs'); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'kyc-test-output.pdf'),res.body);
    const approved=await call('get',`/kyc/${current._id}/pdf?snapshot=approved`,adminToken).buffer(true).parse(binary); expect(approved.status).toBe(200);
  });
  test('reassigns customer on approval and revokes the previous employee KYC/document access',async()=>{
    current=await approveSigned(current,other._id);
    expect((await Customer.findById(customerId)).name).toBe('Revised Customer');
    expect((await call('get',`/kyc/${current._id}`)).status).toBe(404);
    expect((await call('get',`/customer-leads/${current._id}`)).status).toBe(404);
    expect((await call('get',`/kyc/${current._id}/documents/${current.documents[0]._id}`)).status).toBe(404);
    expect(accept(await call('get',`/kyc/${current._id}`,otherToken)).status).toBe('APPROVED');
    expect(accept(await call('get','/customer-leads?status=APPROVED')).some(item=>item._id===current._id)).toBe(false);
  });
  test('records review/edit history and audit entries without sensitive field values',async()=>{
    const history=accept(await call('get',`/kyc/${current._id}`,adminToken)).history;
    expect(history.map(item=>item.action)).toEqual(expect.arrayContaining(['DRAFT_CREATED','DRAFT_SAVED','SUBMITTED','CORRECTION_REQUIRED','REJECTED','APPROVED','REVISION_STARTED']));
    const audits=await AuditLog.find({module:'KYC'}).lean(); expect(audits.length).toBeGreaterThan(20);
    expect(JSON.stringify(audits)).not.toContain(complete.accountNumber);
    expect(JSON.stringify(audits)).not.toContain(complete.idProofNumber);
  });
  test('existing loan and full/partial/extra collection flow still updates balances and cash book',async()=>{
    const created=accept(await call('post','/loans',otherToken).send({customerId,loanAmount:1000,interestPercent:10,durationDays:10,loanDate:'2026-01-01'}),201);
    expect(created.totalPayable).toBe(1100); expect(created.dailyInstallment).toBe(110);
    const schedules=await LoanSchedule.find({loanId:created._id}).sort({dayNumber:1}); expect(schedules).toHaveLength(10);
    expect((await call('post','/collections').send({loanScheduleId:String(schedules[0]._id),amountReceived:50,paymentMode:'CASH'})).status).toBe(403);
    const partial=accept(await call('post','/collections',otherToken).send({loanScheduleId:String(schedules[0]._id),amountReceived:50,paymentMode:'CASH',paymentDate:'2026-01-01',backdateReason:'Synthetic advance at issuance'}),201); expect(partial.status).toBe('PARTIAL');
    accept(await call('post','/collections',otherToken).send({loanScheduleId:String(schedules[0]._id),amountReceived:170,paymentMode:'UPI',paymentDate:'2026-01-01',backdateReason:'Synthetic advance at issuance'}),201);
    const loan=await Loan.findById(created._id); expect(loan.paidAmount).toBe(220); expect(loan.remainingAmount).toBe(880);
    const book=await CashBook.findOne({'entries.referenceId':partial._id}); expect(book).not.toBeNull();
    expect((await call('get',`/collections/receipt/${partial._id}`,otherToken)).status).toBe(200);
  });
  test('adds KYC to an existing legacy customer without changing the profile before approval',async()=>{
    const legacy=await Customer.create({customerCode:'CUS000002',name:'Legacy',fatherName:'Father',mobile:'9876543299',age:35,occupation:'Work',address:'Old address',city:'Mumbai',area:'Central',employeeId:employee._id,createdBy:admin._id});
    const draft=accept(await call('post','/kyc').send({customerId:String(legacy._id),data:{name:'New draft name'}}),201);
    expect(String((await Customer.findById(legacy._id)).kycLeadId)).toBe(draft._id);
    expect((await Customer.findById(legacy._id)).name).toBe('Legacy');
    expect((await call('post','/kyc').send({customerId:String(legacy._id),data:{}})).status).toBe(409);
  });
  test('legacy routes cannot mass-assign approved status or KYC links',async()=>{
    const res=await call('post','/customer-leads').send({name:'Legacy request',fatherName:'Father',mobile:'9876543288',age:30,occupation:'Work',address:'Road',city:'Mumbai',area:'Central',kycVersion:1,customerId,assignedEmployeeId:String(other._id),status:'APPROVED'});
    const lead=accept(res,201); expect(lead.status).toBe('PENDING'); expect(lead.kycVersion).toBeUndefined(); expect(lead.customerId).toBeUndefined();
    expect(lead.assignedEmployeeId).toBeUndefined();
  });
  test('inactive employee and admin accounts cannot access KYC even with an existing token',async()=>{
    await Employee.updateOne({_id:other._id},{$set:{status:'INACTIVE'}});
    try { expect((await call('get',`/kyc/${current._id}`,otherToken)).status).toBe(403); }
    finally { await Employee.updateOne({_id:other._id},{$set:{status:'ACTIVE'}}); }
    await Admin.updateOne({_id:admin._id},{$set:{isActive:false}});
    try { expect((await call('get',`/kyc/${current._id}`,adminToken)).status).toBe(403); }
    finally { await Admin.updateOne({_id:admin._id},{$set:{isActive:true}}); }
  });
});

describe('Immutable paper application',()=>{
 test('retains every submitted revision encrypted and gives both authorized portals the same snapshot',async()=>{
  const Submission=require('../../src/models/KycSubmission'),application=require('../../src/services/kycApplication.service');
  const versions=accept(await call('get',`/kyc/${current._id}/applications`,adminToken));
  expect(versions.filter(v=>v.source==='SUBMITTED')).toHaveLength(4);
  expect(JSON.stringify(versions)).not.toContain('encryptedData');
  const stampBefore=await Submission.findById(versions.at(-1)._id);
  await mongoose.connection.transaction(session=>application.capture({_id:current._id,__v:stampBefore.leadVersion,kycEncrypted:Buffer.from('different'),documentIds:[],history:[]},session,'SUBMITTED'));
  const stampAfter=await Submission.findById(stampBefore._id);expect(stampAfter.updatedAt).toEqual(stampBefore.updatedAt);
  const documents=accept(await call('get',`/kyc/${current._id}/application/documents?revision=${stampBefore._id}`,otherToken));expect(documents.documents.map(d=>d._id)).toEqual(expect.arrayContaining(versions.at(-1).documentIds));
  expect((await call('get',`/kyc/${current._id}/application/documents`)).status).toBe(404);
  const first=versions.at(-1),user={id:String(other._id),role:'EMPLOYEE'};
  const a=await application.resolve(current._id,first._id,{id:String(admin._id),role:'ADMIN'}),b=await application.resolve(current._id,first._id,user);
  expect(a.data).toEqual(b.data);expect(a.data.name).toBe('KYC Customer');expect(a.data.address).toBe(complete.address);
  expect((await application.resolve(current._id,null,user)).data.name).toBe('Revised Customer');
  const raw=await Submission.collection.findOne({_id:new mongoose.Types.ObjectId(first._id)});expect(JSON.stringify(raw)).not.toContain(complete.accountNumber);
  expect((await call('get',`/kyc/${current._id}/applications`)).status).toBe(404);
  expect((await call('get',`/kyc/${current._id}/application/pdf?revision=bad`,otherToken)).status).toBe(404);
  const foreign=await create({name:'Other draft'});expect((await call('get',`/kyc/${foreign._id}/application/pdf?revision=${first._id}`)).status).toBe(404);
 });
 test('renders the professional application as A4 pages and protects public downloads',async()=>{
  const res=await call('get',`/kyc/${current._id}/application/pdf`,adminToken).buffer(true).parse(binary);expect(res.status).toBe(200);expect(res.headers['cache-control']).toBe('no-store');
  const pdf=await PDFDocument.load(res.body);expect(pdf.getPageCount()).toBeGreaterThan(1);for(const p of pdf.getPages()){expect(p.getWidth()).toBeCloseTo(595.28);expect(p.getHeight()).toBeCloseTo(841.89);}
  const dir=path.join(__dirname,'../../../tmp/pdfs');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'royal-application-synthetic.pdf'),res.body);
  expect((await request(app).get(`/api/v1/kyc/${current._id}/application/pdf`)).status).toBe(401);
  expect((await call('get',`/kyc/${current._id}/application/pdf`)).status).toBe(404);
 });
});

describe('Legacy submission date provenance',()=>{
 test('does not present approval time as submission time and never rewrites stored legacy captures',async()=>{
  const application=require('../../src/services/kycApplication.service'),Submission=require('../../src/models/KycSubmission');
  const encrypted=require('../../src/utils/kycCrypto').encrypt(Buffer.from(JSON.stringify(complete)));
  const legacy=await Lead.create({kycVersion:1,status:'APPROVED',name:'Synthetic legacy',submittedByEmployeeId:other._id,kycEncrypted:encrypted,approvedKycEncrypted:encrypted,approvedAt:new Date('2026-01-20T00:00:00Z'),history:[]});
  await mongoose.connection.transaction(session=>application.capture(legacy,session,'LEGACY_APPROVED'));
  const row=await Submission.findOne({leadId:legacy._id});expect(row.submittedAt).toBeUndefined();
  await Submission.collection.updateOne({_id:row._id},{$set:{submittedAt:legacy.approvedAt}});
  const user={id:String(other._id),role:'EMPLOYEE'};
  expect((await application.resolve(String(legacy._id),String(row._id),user)).submittedAt).toBeUndefined();
  expect((await application.list(String(legacy._id),user))[0].submittedAt).toBeNull();
  expect((await Submission.findById(row._id)).submittedAt).toEqual(legacy.approvedAt);
  const actual=new Date('2026-01-10T00:00:00Z');legacy.history.push({action:'SUBMITTED',at:actual},{action:'SUBMITTED',at:new Date(row.createdAt.getTime()+100000)});await legacy.save();
  expect((await application.resolve(String(legacy._id),String(row._id),user)).submittedAt).toEqual(actual);
 });
});

describe('Shared A4 application with actual authorized test images',()=>{
 test('both portals render six private uploaded images from the same submitted snapshot',async()=>{
  let draft=await create({...complete,mobile:'9876543277'});
  for(const kind of ['PHOTO','IDENTITY','ADDRESS','BUSINESS','INCOME','SIGNATURE']){
   draft=accept(await call('post',`/kyc/${draft._id}/documents`).field('kind',kind).field('version',String(draft.version)).attach('file',fs.readFileSync(path.join(__dirname,'../fixtures/kyc-documents',kind.toLowerCase()+'.png')),{filename:kind.toLowerCase()+'.png',contentType:'image/png'}),201);
  }
  draft=await submitSigned(draft);
  const versions=accept(await call('get',`/kyc/${draft._id}/applications`,adminToken));
  const url=`/kyc/${draft._id}/application/pdf?revision=${versions[0]._id}`;
  const beforeExport=await Lead.findById(draft._id).select('+kycEncrypted +approvedKycEncrypted').lean();
  const submissionsBefore=await require('../../src/models/KycSubmission').find({leadId:draft._id}).select('+encryptedData').lean();
  let pages;
  for(const auth of [adminToken,token]){
   const response=await call('get',url,auth).buffer(true).parse(binary);
   expect(response.status).toBe(200);expect(response.headers['cache-control']).toBe('no-store');
   const pdf=await PDFDocument.load(response.body);
   const images=pdf.context.enumerateIndirectObjects().map(([,obj])=>obj).filter(obj=>obj.dict?.get(require('pdf-lib').PDFName.of('Subtype'))?.toString()==='/Image');
   expect(images).toHaveLength(8); // Original logo, six customer images, employee verification
   if(pages)expect(pdf.getPageCount()).toBe(pages);pages=pdf.getPageCount();
   fs.writeFileSync(path.join(__dirname,`../../../tmp/pdfs/authorized-${auth===adminToken?'admin':'employee'}-application.pdf`),response.body);
  }
  expect((await call('get',url,otherToken)).status).toBe(404);
  expect((await request(app).get('/api/v1'+url)).status).toBe(401);
  const stored=await Lead.findById(draft._id);expect(stored.documentIds).toHaveLength(6);expect(stored.status).toBe('PENDING');
  expect(await Lead.findById(draft._id).select('+kycEncrypted +approvedKycEncrypted').lean()).toEqual(beforeExport);
  expect(await require('../../src/models/KycSubmission').find({leadId:draft._id}).select('+encryptedData').lean()).toEqual(submissionsBefore);
 });
});

test('authorized KYC history exposes actor display names without rewriting audit records',async()=>{
 const draft=await create({name:'Synthetic history UI',mobile:'9876543266'});const before=JSON.stringify((await Lead.findById(draft._id)).history);
 const response=await call('get','/kyc/'+draft._id);expect(response.status).toBe(200);expect(response.body.data.history[0].actorName).toBe(employee.name);expect(response.body.data.history[0].actorId).toBe(String(employee._id));
 expect(JSON.stringify((await Lead.findById(draft._id)).history)).toBe(before);expect((await call('get','/kyc/'+draft._id,otherToken)).status).toBe(404);
});

describe('Authenticated revision-bound signatures and immutable final approval',()=>{
 test('enforces consent, role, ownership, image validation, revision binding and explicit final approval',async()=>{
  let record=await create({...complete,mobile:'9876543266'});
  for(const kind of ['PHOTO','IDENTITY','ADDRESS','SIGNATURE'])record=accept(await call('post',`/kyc/${record._id}/documents`).field('kind',kind).field('version',String(record.version)).attach('file',fs.readFileSync(path.join(__dirname,'../fixtures/kyc-documents/'+kind.toLowerCase()+'.png')),{filename:'doc.png',contentType:'image/png'}),201);
  const sig=await verification(record);
  const raw=await require('../../src/models/KycVerificationSignature').findById(sig._id).select('+encryptedBytes');expect(raw.name).toBe(employee.name);expect(raw.role).toBe('EMPLOYEE');expect(raw.encryptedBytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))).toBe(false);
  const signURL=`/kyc/${record._id}/verification-signatures`;
  expect((await call('post',signURL,otherToken).field('version',String(record.version)).attach('file',image,{filename:'x.png',contentType:'image/png'})).status).toBe(404);
  expect((await call('post',signURL,adminToken).field('version',String(record.version)).attach('file',image,{filename:'x.png',contentType:'image/png'})).status).toBe(409);
  expect((await call('post',signURL).field('version',String(record.version)).attach('file',Buffer.from('not an image'),{filename:'x.png',contentType:'image/png'})).status).toBe(422);
  expect((await call('post',`/kyc/${record._id}/submit`).send({version:record.version,signatureId:sig._id})).status).toBe(422);
  record=accept(await call('put',`/kyc/${record._id}`).send({data:record.data,version:record.version}));
  expect((await call('post',`/kyc/${record._id}/submit`).send({version:record.version,signatureId:sig._id,confirmed:true})).status).toBe(422);
  record=await submitSigned(record);expect(record.status).toBe('PENDING');expect(record.employeeVerification.employeeCode).toBe(employee.employeeCode);
  const pending=await require('../../src/services/kycApplication.service').resolve(record._id,null,{id:String(employee._id),role:'EMPLOYEE'});expect(pending.approval).toBeNull();expect((await require('../../src/services/kycSignature.service').evidence(pending)).admin).toBeUndefined();
  const secondAdmin=await Admin.create({name:'Second signing Admin',email:'second-signing@kyc.test',password:'Secret123!',phone:'9876543255'});
  const secondAdminToken=generateToken(String(secondAdmin._id),'ADMIN');
  const otherAdminSignature=await verification(record,secondAdminToken);
  const adminSig=await verification(record,adminToken);
  const url=`/customer-leads/${record._id}/approve`,body={version:record.version,employeeId:String(employee._id),signatureId:adminSig._id};
  expect((await call('post',url,adminToken).send(body)).status).toBe(422);
  expect((await call('post',url,adminToken).send({...body,signatureId:otherAdminSignature._id,confirmed:true})).status).toBe(422);
  expect((await call('post',url).send({...body,confirmed:true})).status).toBe(403);
  expect((await call('post',url,adminToken).send({...body,signatureId:record.employeeVerification._id,confirmed:true})).status).toBe(422);
  expect((await call('post',url,adminToken).send({...body,employeeId:'invalid',confirmed:true})).status).toBe(400);
  const [one,two]=await Promise.all([call('post',url,adminToken).send({...body,confirmed:true}),call('post',url,adminToken).send({...body,confirmed:true})]);expect([one.status,two.status].sort()).toEqual([200,409]);record=(one.status===200?one:two).body.data;
  const Approval=require('../../src/models/KycApproval');expect(await Approval.countDocuments({leadId:record._id})).toBe(1);
  const final=await call('get',`/kyc/${record._id}/application/pdf`,adminToken).buffer(true).parse(binary);expect(final.status).toBe(200);
  const employeePdf=await call('get',`/kyc/${record._id}/pdf`).buffer(true).parse(binary);expect(employeePdf.body).toEqual(final.body);
  const pdf=await PDFDocument.load(final.body),images=pdf.context.enumerateIndirectObjects().filter(([,o])=>o.dict?.get(require('pdf-lib').PDFName.of('Subtype'))?.toString()==='/Image');expect(images.length).toBe(7);
  const dir=path.join(__dirname,'../../../tmp/kyc-signatures');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'signed-application.pdf'),final.body);
  const approval=await Approval.findById(record.approvalId).select('+signedPdfEncrypted');expect(require('crypto').createHash('sha256').update(final.body).digest('hex')).toBe(approval.pdfDigest);
  const revision=String(approval.submissionId);record=accept(await call('post',`/kyc/${record._id}/revise`).send({version:record.version}));expect(record.approvalId).toBeUndefined();expect(record.employeeVerification).toBeNull();
  const original=await call('get',`/kyc/${record._id}/application/pdf?revision=${revision}`).buffer(true).parse(binary);expect(original.body).toEqual(final.body);
  expect((await call('get',`/kyc/${record._id}/verification-signatures/${adminSig._id}`,otherToken)).status).toBe(404);
  expect((await request(app).get('/api/v1'+`/kyc/${record._id}/verification-signatures/${adminSig._id}`)).status).toBe(401);
 });
});
