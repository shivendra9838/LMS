const mongoose=require('mongoose'),request=require('supertest'),{MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Lead=require('../../src/models/CustomerLead'),Customer=require('../../src/models/Customer'),Document=require('../../src/models/KycDocument');
const {generateToken}=require('../../src/utils/jwt');
jest.setTimeout(180000);let repl,admin,employee,other,at,et,cid,pending,kyc;
const get=(query={},token=at)=>request(app).get('/api/v1/customer-leads').query({requestDirectory:'true',...query}).set('Authorization','Bearer '+token);
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-request-directory';process.env.KYC_ENCRYPTION_KEY='29'.repeat(32);repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'isolated_customer_requests'});
 admin=await Admin.create({name:'Synthetic Admin',email:'request-admin@example.test',password:'Isolated123!',phone:'9700000000'});
 const create=i=>Employee.create({name:i===1?'Synthetic Referrer':'Other Referrer',employeeCode:'EMP000'+i,email:'request-employee'+i+'@example.test',phone:'970000000'+i,password:'Isolated123!',city:'Test',area:'Test',createdBy:admin._id});employee=await create(1);other=await create(2);at=generateToken(admin._id,'ADMIN');et=generateToken(employee._id,'EMPLOYEE');
 cid=await Customer.create({name:'Approved Real Fixture',customerCode:'CUS000001',employeeId:employee._id,createdBy:admin._id,mobile:'9800000000',fatherName:'Synthetic',age:30,occupation:'Test',address:'Test',city:'Test',area:'Test'});
 await Promise.all([Lead,Document].map(model=>model.init()));
 const base={fatherName:'Synthetic',age:30,occupation:'Test',address:'Test',city:'Test',area:'Test',submittedByEmployeeId:employee._id};
 pending=await Lead.create({...base,name:'Literal .* [x] referral',mobile:'9800000001',createdAt:new Date('2026-10-26T18:29:59Z')});
 await Lead.create({...base,name:'Other pending',mobile:'9800000002',submittedByEmployeeId:other._id});
 await Lead.create({...base,name:cid.name,mobile:cid.mobile,status:'APPROVED',customerId:cid._id,adminRemarks:'Original approval retained'});
 await Lead.create({...base,name:'Correction fixture',mobile:'9800000003',status:'CORRECTION_REQUIRED',kycVersion:1});
 await Lead.create({...base,name:'Rejected fixture',mobile:'9800000004',status:'REJECTED',adminRemarks:'Synthetic rejection reason'});
 await Lead.create({...base,name:'Draft fixture',status:'DRAFT',kycVersion:1});
 kyc=await Lead.create({...base,name:'Pending KYC fixture',mobile:'9800000005',kycVersion:1,kycEncrypted:Buffer.from('DO_NOT_EXPOSE_PRIVATE'),history:[{action:'SUBMITTED',at:new Date('2026-10-26T18:30:00Z')}],createdAt:new Date('2026-10-20T00:00Z')});
 const doc=await Document.create({leadId:kyc._id,kind:'PHOTO',mime:'image/png',size:1,digest:'synthetic',encryptedBytes:Buffer.from('PRIVATE_IMAGE'),uploadedBy:employee._id});kyc.documentIds=[doc._id];await kyc.save();
});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});
test('four status counts include legacy and KYC requests, exclude drafts, and keep approved customers',async()=>{
 const before=JSON.stringify(await Lead.find().sort({_id:1}).lean()),response=await get();expect(response.status).toBe(200);expect(response.body.meta.counts).toEqual({PENDING:3,CORRECTION_REQUIRED:1,APPROVED:1,REJECTED:1});
 for(const status of ['PENDING','CORRECTION_REQUIRED','APPROVED','REJECTED']){const r=await get({status});expect(r.status).toBe(200);expect(r.body.data.every(row=>row.status===status)).toBe(true);}
 const approved=(await get({status:'APPROVED'})).body.data[0];expect(approved.customerId).toBe(String(cid._id));expect(approved.customerCode).toBe(cid.customerCode);expect(approved.adminRemarks).toBe('Original approval retained');expect(JSON.stringify(await Lead.find().sort({_id:1}).lean())).toBe(before);
});
test('search matches customer code, mobile and referring employee, treating regex characters literally',async()=>{
 for(const search of ['.*','[x]','9800000001']){const r=await get({search});expect(r.status).toBe(200);expect(r.body.meta.total).toBe(1);expect(r.body.data[0]._id).toBe(String(pending._id));}
 expect((await get({search:'EMP0002'})).body.meta.total).toBe(1);expect((await get({search:'Synthetic Referrer'})).body.meta.total).toBe(2);expect((await get({status:'APPROVED',search:'CUS000001'})).body.meta.total).toBe(1);
});
test('employee and IST request-date filters operate before counts; paging and sorting are stable',async()=>{
 const own=await get({employeeId:String(employee._id),limit:1});expect(own.body.meta.total).toBe(2);expect(own.body.meta.totalPages).toBe(2);const next=await get({employeeId:String(employee._id),page:2,limit:1});expect(next.body.data[0]._id).not.toBe(own.body.data[0]._id);
 const date=await get({startDate:'2026-10-27',endDate:'2026-10-27'});expect(date.body.meta.total).toBe(1);expect(date.body.data[0]._id).toBe(String(kyc._id));expect(date.body.data[0].requestDate).toBe('2026-10-26T18:30:00.000Z');
 const oldest=await get({sort:'oldest'});expect(oldest.body.data[0]._id).toBe(String(pending._id));expect((await get({startDate:'2026-10-28',endDate:'2026-10-27'})).status).toBe(422);
});
test('directory projection returns safe metadata and document IDs only; auth and validation remain enforced',async()=>{
 const r=await get(),row=r.body.data.find(value=>value._id===String(kyc._id));expect(row.photoDocumentId).toBe(String(kyc.documentIds[0]));expect(row.submittedByEmployeeId).toMatchObject({name:employee.name,employeeCode:employee.employeeCode});for(const key of ['kycEncrypted','approvedKycEncrypted','history','documentIds','idProofNumber'])expect(row[key]).toBeUndefined();expect(JSON.stringify(r.body)).not.toMatch(/DO_NOT_EXPOSE|PRIVATE_IMAGE|password/);
 expect((await request(app).get('/api/v1/customer-leads?status=PENDING&sort=name&employeeId=legacy-unused-filter').set('Authorization','Bearer '+at)).status).toBe(200);
 expect((await get({},et)).status).toBe(403);expect((await request(app).get('/api/v1/customer-leads?requestDirectory=true')).status).toBe(401);
 for(const query of [{employeeId:'bad'},{page:0},{limit:201},{sort:'wrong'},{status:'DRAFT'},{search:'x'.repeat(101)}])expect([400,422]).toContain((await get(query)).status);
});
