const mongoose=require('mongoose'),request=require('supertest');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection');
const {generateToken}=require('../../src/utils/jwt'),{createLoanService}=require('../../src/services/loan.service');
const {businessDay,addDays}=require('../../src/utils/businessDay');
jest.setTimeout(180000);
let repl,admin,employee,other,token,adminToken,otherToken,serial=0;
const key=()=>require('crypto').randomBytes(16).toString('hex');
const call=(method,url,auth=token)=>request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+auth);
const ok=(res,status=200)=>{expect({status:res.status,body:res.body}).toMatchObject({status});return res.body.data;};
const pay=(row,amount,extra={},auth=token)=>call('post','/collections',auth).send({loanScheduleId:String(row._id),amountReceived:amount,paymentMode:'CASH',financeVersion:2,idempotencyKey:key(),...extra});
const list=(loan,scope='ALL',auth=token,extra='')=>call('get',`/collections/installments?loanId=${loan._id}&scope=${scope}&page=1&limit=100${extra}`,auth).then(r=>ok(r));
async function issue(daysAgo=1){const n=++serial,c=await Customer.create({customerCode:'CUS-SEQ-'+n,name:'Synthetic sequence customer '+n,employeeId:employee._id,createdBy:employee._id,fatherName:'Synthetic',mobile:String(9200000000+n),age:35,occupation:'Test',address:'Test only',city:'Test',area:'Sequence'});const loan=await createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-daysAgo)},{id:String(employee._id),role:'EMPLOYEE'});return {loan,rows:await Schedule.find({loanId:loan._id}).sort({dayNumber:1})};}
async function day3(){const fixture=await issue();ok(await pay(fixture.rows[0],1400),201);return fixture;}
const financial=async()=>JSON.stringify(await Promise.all([Loan,Schedule,Collection,require('../../src/models/CollectionPosition'),require('../../src/models/EmployeeSettlement'),require('../../src/models/CashBook')].map(m=>m.find().sort({_id:1}).lean())));
beforeAll(async()=>{process.env.JWT_SECRET='isolated-sequence-tests';process.env.KYC_ENCRYPTION_KEY='75'.repeat(32);repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'minimum_payment_isolated'});admin=await Admin.create({name:'Synthetic Admin',email:'sequence-admin@example.test',password:'Isolated123!',phone:'9200000000'});employee=await Employee.create({name:'Synthetic Employee',employeeCode:'EMP-SEQ',email:'sequence-employee@example.test',password:'Isolated123!',phone:'9200000001',city:'Test',area:'Sequence',createdBy:admin._id});other=await Employee.create({name:'Other',employeeCode:'EMP-OTHER',email:'sequence-other@example.test',password:'Isolated123!',phone:'9200000002',city:'Test',area:'Sequence',createdBy:admin._id});token=generateToken(employee._id,'EMPLOYEE');adminToken=generateToken(admin._id,'ADMIN');otherToken=generateToken(other._id,'EMPLOYEE');});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});


test('server quote prefills today and API rejects below minimum without financial writes',async()=>{
 const {loan,rows}=await issue(1),before=await financial();
 const quote=ok(await call('get',`/collections/installments/${rows[0]._id}/allocation-preview`));
 expect(quote).toMatchObject({amount:700,minimum:{previousOverdue:0,todayUnpaid:700,minimumPayment:700},meetsMinimum:true});
 for(const amount of [0,-1,'invalid','1.001'])expect([400,422]).toContain((await pay(rows[0],amount)).status);
 for(const amount of [699.99,999999])expect((await pay(rows[0],amount)).status).toBe(422);
 expect(await financial()).toBe(before);
 const payment=ok(await pay(rows[0],700),201);expect(payment.allocations[0].amount).toBe(700);
 expect((await Loan.findById(loan._id)).remainingAmount).toBe(20300);
});
test('partial advance reduces real minimum, extra payment allocates only once and retry is idempotent',async()=>{
 const {loan,rows}=await issue(2),issueDay=businessDay(loan.loanDate);
 ok(await pay(rows[0],300,{paymentDate:issueDay,backdateReason:'Synthetic advance at issue'}),201);
 const quote=ok(await call('get',`/collections/installments/${rows[0]._id}/allocation-preview`));
 expect(quote).toMatchObject({amount:1100,minimum:{previousOverdue:400,todayUnpaid:700,minimumPayment:1100}});
 const before=await financial();expect((await pay(rows[0],1099.99,{minimumPayment:0})).status).toBe(422);expect(await financial()).toBe(before);
 const idempotencyKey=key(),payment=ok(await pay(rows[0],1200,{idempotencyKey}),201);
 expect(payment.allocations.map(a=>a.amount)).toEqual([400,700,100]);
 expect(ok(await pay(rows[0],1200,{idempotencyKey}),201)._id).toBe(payment._id);
 expect((await Loan.findById(loan._id)).paidAmount).toBe(1500);
 const future=ok(await call('get',`/collections/installments/${rows[2]._id}/allocation-preview`));expect(future.minimum.minimumPayment).toBe(0);
 ok(await pay(rows[2],0.01),201);
});
test('backdate uses effective date, requires reason and preserves entry time; ownership remains enforced',async()=>{
 const {loan,rows}=await issue(4),day=addDays(businessDay(loan.loanDate),2);
 const quote=ok(await call('get',`/collections/installments/${rows[0]._id}/allocation-preview?paymentDate=${day}`));expect(quote.minimum.minimumPayment).toBe(1400);
 const before=await financial();
 expect((await pay(rows[0],1399,{paymentDate:day,backdateReason:'Synthetic historic receipt'})).status).toBe(422);
 expect((await pay(rows[0],1400,{paymentDate:day})).status).toBe(422);
 expect((await pay(rows[0],1400,{},otherToken)).status).toBe(403);
 expect((await call('get',`/collections/installments/${rows[0]._id}/allocation-preview?paymentDate=${addDays(businessDay(),1)}`)).status).toBe(422);
 expect((await call('get',`/collections/installments/${rows[0]._id}/allocation-preview?paymentDate=${addDays(businessDay(loan.loanDate),-1)}`)).status).toBe(422);
 expect(await financial()).toBe(before);
 const receipt=ok(await pay(rows[0],1400,{paymentDate:day,backdateReason:'Synthetic historic receipt'}),201);
 expect(businessDay(receipt.paymentDate)).toBe(day);expect(businessDay(receipt.createdAt)).toBe(businessDay());
 expect(receipt.allocations.map(a=>a.amount)).toEqual([700,700]);
});
test('stale quotes do not authorize a smaller minimum after an isolated balance correction',async()=>{
 const {loan,rows}=await issue(1);ok(await pay(rows[0],700),201);
 const quote=ok(await call('get',`/collections/installments/${rows[1]._id}/allocation-preview`));expect(quote.minimum.minimumPayment).toBe(0);
 // Synthetic fixture only: simulate an audited correction of the earlier allocation.
 await mongoose.connection.transaction(async session=>{await Schedule.updateOne({_id:rows[0]._id},{$set:{paidAmount:600,status:'PARTIAL'}},{session});await Loan.updateOne({_id:loan._id},{$inc:{paidAmount:-100,remainingAmount:100}},{session});});
 const before=await financial();expect((await pay(rows[0],99)).status).toBe(422);expect(await financial()).toBe(before);ok(await pay(rows[0],100),201);
});
