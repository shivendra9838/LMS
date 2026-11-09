const mongoose=require('mongoose'),request=require('supertest');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app');
const Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection'),Assessment=require('../../src/models/CustomerRiskAssessment');
const {generateToken}=require('../../src/utils/jwt'),{createLoanService}=require('../../src/services/loan.service');
const {businessDay,addDays}=require('../../src/utils/businessDay');
jest.setTimeout(180000);
let repl,admin,employee,other,customer,loan,adminToken,token,otherToken,rows;
const call=(path,auth=token)=>request(app).get('/api/v1/customer-risk'+path).set('Authorization','Bearer '+auth);
const financialSnapshot=async()=>JSON.stringify(await Promise.all([Customer,Loan,Schedule,Collection,require('../../src/models/CollectionPosition'),require('../../src/models/EmployeeSettlement')].map(m=>m.find().sort({_id:1}).lean())));
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-risk-tests';process.env.KYC_ENCRYPTION_KEY='75'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'customer_risk_isolated'});
 admin=await Admin.create({name:'Synthetic Admin',email:'risk-admin@example.test',password:'Isolated123!',phone:'9100000000'});
 employee=await Employee.create({name:'Synthetic Employee',employeeCode:'EMP-RISK',email:'risk-employee@example.test',password:'Isolated123!',phone:'9100000001',city:'Test',area:'Risk',createdBy:admin._id});
 other=await Employee.create({name:'Other',employeeCode:'EMP-OTHER',email:'risk-other@example.test',password:'Isolated123!',phone:'9100000002',city:'Test',area:'Risk',createdBy:admin._id});
 adminToken=generateToken(admin._id,'ADMIN');token=generateToken(employee._id,'EMPLOYEE');otherToken=generateToken(other._id,'EMPLOYEE');
 customer=await Customer.create({customerCode:'CUS-RISK',name:'Synthetic risk customer',employeeId:employee._id,createdBy:admin._id,fatherName:'Synthetic',mobile:'9100000010',age:35,occupation:'Test',address:'Test',city:'Test',area:'Risk'});
 loan=await createLoanService({customerId:String(customer._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-8)},{id:String(employee._id),role:'EMPLOYEE'});
 rows=await Schedule.find({loanId:loan._id}).sort({dayNumber:1});await Assessment.init();
});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});
test('authenticated Admin and assigned Employee get consistent scores without financial writes',async()=>{
 const before=await financialSnapshot(),a=await call('/'+customer._id),b=await call('/'+customer._id,adminToken);
 expect(a.status).toBe(200);expect(b.status).toBe(200);expect(a.body.data).toMatchObject({category:'HIGH_RISK',metrics:{overdueInstallments:7,overdueAmount:4900}});
 for(const field of ['category','score','ratingStatus','confidence','inputHash','policyHash','metrics'])expect(a.body.data[field]).toEqual(b.body.data[field]);expect(a.body.data.evidence).toBeUndefined();
 expect(await financialSnapshot()).toBe(before);expect(await Assessment.countDocuments({customerId:customer._id})).toBe(2);
 const auditBefore=JSON.stringify(await Assessment.find().sort({_id:1}).lean());await call('/'+customer._id);expect(await Assessment.countDocuments({customerId:customer._id})).toBe(2);expect(JSON.stringify(await Assessment.find().sort({_id:1}).lean())).toBe(auditBefore);
});
test('foreign employees cannot infer customer data through detail, batch, filters or enumeration',async()=>{
 expect((await call('/'+customer._id,otherToken)).status).toBe(404);
 expect((await call('/batch?ids='+customer._id,otherToken)).body.data).toEqual([]);
 expect((await call('/',otherToken)).body.data.meta.total).toBe(0);
 expect((await call('/?employeeId='+employee._id,otherToken)).status).toBe(403);
 expect((await request(app).get('/api/v1/customer-risk/'+customer._id)).status).toBe(401);
});
test('input validation and true category filtering retain server pagination',async()=>{
 expect((await call('/bad')).status).toBe(422);expect((await call('/batch?ids=bad')).status).toBe(422);
 expect((await call('/?category=BAD')).status).toBe(422);expect((await call('/?limit=101')).status).toBe(422);
 const result=await call('/?category=HIGH_RISK&page=1&limit=1',adminToken);expect(result.status).toBe(200);expect(result.body.data.rows).toHaveLength(1);expect(result.body.data.meta).toMatchObject({page:1,limit:1,total:1});
 expect((await call('/?category=GOOD',adminToken)).body.data.rows).toEqual([]);
 expect((await call('/?search=%2E%2A',adminToken)).body.data.rows).toEqual([]);
 expect((await call('/?page=2&limit=1',adminToken)).body.data.rows).toEqual([]);
});
test('real isolated backdated multi-installment payment recalculates on next read, preserving entry dates and custody',async()=>{
 const before=(await call('/'+customer._id)).body.data;
 const res=await request(app).post('/api/v1/collections').set('Authorization','Bearer '+token).send({loanScheduleId:String(rows[0]._id),amountReceived:2100,paymentMode:'CASH',financeVersion:2,idempotencyKey:require('crypto').randomBytes(16).toString('hex'),paymentDate:addDays(businessDay(),-7),backdateReason:'Synthetic prior field receipt for isolated test'});
 expect(res.status).toBe(201);
 const financial=await financialSnapshot(),after=(await call('/'+customer._id)).body.data;
 expect(after.metrics).toMatchObject({onTimeCount:1,earlyCount:2,overdueInstallments:4,overdueAmount:2800});expect(after.inputHash).not.toBe(before.inputHash);expect(before.score).toBeNull();expect(after.score).toEqual(expect.any(Number));
 expect(await financialSnapshot()).toBe(financial);expect(await Assessment.countDocuments({customerId:customer._id})).toBe(3);
 const position=await require('../../src/models/CollectionPosition').findOne({collectionId:res.body.data._id}).lean();expect(position.settledMinor).toBe(0);
});
test('reassignment removes prior employee risk access without changing loan servicing records',async()=>{
 await Customer.updateOne({_id:customer._id},{$set:{employeeId:other._id}});
 expect((await call('/'+customer._id)).status).toBe(404);expect((await call('/'+customer._id,otherToken)).status).toBe(200);
 expect(String((await Loan.findById(loan._id)).employeeId)).toBe(String(employee._id));
});

test('a real three-installment receipt publishes consistent provisional results; an invalidated receipt removes them',async()=>{
 const c=await Customer.create({customerCode:'CUS-RISK-PROVISIONAL',name:'Synthetic provisional customer',employeeId:employee._id,createdBy:admin._id,fatherName:'Synthetic',mobile:'9100000099',age:35,occupation:'Test',address:'Test',city:'Test',area:'Risk'});
 const l=await createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-3)},{id:String(employee._id),role:'EMPLOYEE'}),s=await Schedule.findOne({loanId:l._id}).sort({dayNumber:1});
 expect((await call('/'+c._id)).body.data).toMatchObject({score:null,ratingStatus:'UNRATED'});
 const receipt=await request(app).post('/api/v1/collections').set('Authorization','Bearer '+token).send({loanScheduleId:String(s._id),amountReceived:2100,paymentMode:'CASH',financeVersion:2,idempotencyKey:require('crypto').randomBytes(16).toString('hex'),paymentDate:addDays(businessDay(),-2),backdateReason:'Isolated verified provisional evidence'});
 expect(receipt.status).toBe(201);
 const before=await financialSnapshot(),a=(await call('/'+c._id)).body.data,b=(await call('/'+c._id,adminToken)).body.data;
 expect(a).toMatchObject({score:100,ratingStatus:'PROVISIONAL',category:'INSUFFICIENT_HISTORY',confidence:{level:'LOW'},metrics:{verifiedCompletedInstallments:3,onTimeCount:1,earlyCount:2}});
 expect(a.score).toBe(b.score);expect(a.confidence).toEqual(b.confidence);expect(await financialSnapshot()).toBe(before);
 // Native fixture update models an invalidated legacy receipt without adding a
 // reversal feature or touching the configured database.
 await require('../../src/models/Collection').collection.updateOne({_id:new mongoose.Types.ObjectId(receipt.body.data._id)},{$set:{status:'VOIDED'}});
 const invalidated=await financialSnapshot(),after=(await call('/'+c._id)).body.data;
 expect(after).toMatchObject({score:null,ratingStatus:'UNRATED',metrics:{verifiedCompletedInstallments:0,unknownHistoryCount:3}});
 expect(await financialSnapshot()).toBe(invalidated);
});
