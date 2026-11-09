const mongoose=require('mongoose'),request=require('supertest');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Lead=require('../../src/models/CustomerLead'),Document=require('../../src/models/KycDocument');
const {generateToken}=require('../../src/utils/jwt');
let repl,admin,employee,other,token,otherToken,adminToken,customer,lead;
jest.setTimeout(180000);
const get=(path,auth=token)=>request(app).get('/api/v1'+path).set('Authorization','Bearer '+auth);
const snapshot=async()=>JSON.stringify(await Promise.all([Customer,Lead,Document,require('../../src/models/Loan'),require('../../src/models/Collection')].map(m=>m.find().sort({_id:1}).lean())));
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-directory-tests';process.env.KYC_ENCRYPTION_KEY='63'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'directory_readonly_test'});
 admin=await Admin.create({name:'Synthetic Admin',email:'dir-admin@example.test',password:'Isolated123!',phone:'9100000000'});
 employee=await Employee.create({name:'Employee',employeeCode:'EMP-DIR',email:'dir@example.test',password:'Isolated123!',phone:'9100000001',city:'Test',area:'Directory',createdBy:admin._id});other=await Employee.create({name:'Other',employeeCode:'EMP-DIR2',email:'dir2@example.test',password:'Isolated123!',phone:'9100000002',city:'Test',area:'Directory',createdBy:admin._id});
 token=generateToken(employee._id,'EMPLOYEE');otherToken=generateToken(other._id,'EMPLOYEE');adminToken=generateToken(admin._id,'ADMIN');
 customer=await Customer.create({customerCode:'CUS-DIR',name:'Synthetic Directory',employeeId:employee._id,createdBy:admin._id,fatherName:'Synthetic',mobile:'9100000010',age:35,occupation:'Test',address:'Test',city:'Test',area:'Directory'});
 lead=await Lead.create({kycVersion:1,name:'Synthetic approved',mobile:'9100000010',customerId:customer._id,submittedByEmployeeId:other._id,assignedEmployeeId:other._id,status:'APPROVED',history:[{action:'SUBMITTED',at:new Date('2026-10-25T00:00:00+05:30')},{action:'APPROVED',at:new Date('2026-10-26T00:00:00+05:30')} ]});
 const photo=await Document.create({leadId:lead._id,kind:'PHOTO',mime:'image/png',size:3,digest:'synthetic',encryptedBytes:Buffer.from('test-only'),uploadedBy:employee._id});const identity=await Document.create({leadId:lead._id,kind:'IDENTITY',mime:'image/png',size:3,digest:'synthetic2',encryptedBytes:Buffer.from('test-only'),uploadedBy:employee._id});lead.documentIds=[photo._id,identity._id];await lead.save();
 for(const [i,status]of ['DRAFT','PENDING','REJECTED','CORRECTION_REQUIRED'].entries())await Lead.create({kycVersion:1,name:'Synthetic '+status,mobile:'910000002'+i,submittedByEmployeeId:employee._id,status,history:status==='DRAFT'?[]:[{action:'SUBMITTED',at:new Date('2026-10-24T23:59:59+05:30')}]});
 await Lead.create({kycVersion:1,name:'Foreign draft',submittedByEmployeeId:other._id,status:'DRAFT'});
});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});
test('KYC all counts are ownership scoped, dates are actual events and only photo metadata is exposed',async()=>{
 const before=await snapshot(),res=await get('/customer-leads?listing=true&status=ALL&limit=2');expect(res.status).toBe(200);expect(res.body.meta).toMatchObject({total:5,totalPages:3,counts:{ALL:5,DRAFT:1,PENDING:1,APPROVED:1,REJECTED:1,CORRECTION_REQUIRED:1}});
 const approved=await get('/customer-leads?listing=true&status=APPROVED');expect(approved.body.data[0]).toMatchObject({name:'Synthetic approved',customerCode:'CUS-DIR',submittedOn:'2026-10-24T18:30:00.000Z',reviewedOn:'2026-10-25T18:30:00.000Z'});expect(approved.body.data[0].photoDocumentId).toBeTruthy();expect(JSON.stringify(approved.body)).not.toMatch(/encryptedBytes|documentIds|history|kycEncrypted/);expect(await snapshot()).toBe(before);
});
test('KYC search, tabs, IST date bounds and missing dates work without writes',async()=>{
 expect((await get('/customer-leads?listing=true&status=ALL&search=APPROV')).body.meta.total).toBe(1);
 expect((await get('/customer-leads?listing=true&status=ALL&startDate=2026-10-25&endDate=2026-10-25')).body.meta.total).toBe(1);
 const draft=await get('/customer-leads?listing=true&status=DRAFT');expect(draft.body.data[0].submittedOn).toBeNull();expect(draft.body.data[0].reviewedOn).toBeUndefined();
 expect((await get('/customer-leads?listing=true&startDate=2026-10-26&endDate=2026-10-25')).status).toBe(422);expect((await get('/customer-leads?listing=true&startDate=2026-02-31')).status).toBe(400);
});
test('KYC current customer ownership overrides stale assignedEmployeeId and excludes Admin drafts',async()=>{
 expect((await get('/customer-leads?listing=true&status=APPROVED',otherToken)).body.data).toEqual([]);
 expect((await get('/customer-leads?listing=true&status=ALL',adminToken)).body.meta.counts.DRAFT).toBe(0);
 expect((await request(app).get('/api/v1/customer-leads?listing=true')).status).toBe(401);
});
test('risk listing summary preserves insufficient history, supports mobile substring and status filtering',async()=>{
 const before=await snapshot(),res=await get('/customer-risk?search=000010&status=ACTIVE');expect(res.status).toBe(200);expect(res.body.data.summary).toEqual({total:1,counts:{GOOD:0,REVIEW_REQUIRED:0,HIGH_RISK:0,INSUFFICIENT_HISTORY:1}});expect(res.body.data.rows[0]).toMatchObject({mobile:'9100000010',loanCount:0,totalOutstanding:0,lastPayment:null,category:'INSUFFICIENT_HISTORY',score:null});expect((await get('/customer-risk?category=GOOD')).body.data.summary.total).toBe(1);expect((await get('/customer-risk',otherToken)).body.data.meta.total).toBe(0);expect((await get('/customer-risk?status=WRONG')).status).toBe(422);expect(await snapshot()).toBe(before);
});

