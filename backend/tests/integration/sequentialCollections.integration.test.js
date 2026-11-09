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
// Historical sequence/review fixtures use valid issue-date advances; due-date minimums have a dedicated API suite.
const pay=async(row,amount,extra={},auth=token)=>{const loan=await Loan.findById(row.loanId);return call('post','/collections',auth).send({paymentDate:businessDay(loan.loanDate),backdateReason:'Synthetic advance received on issue date',loanScheduleId:String(row._id),amountReceived:amount,paymentMode:'CASH',financeVersion:2,idempotencyKey:key(),...extra});};
const list=(loan,scope='ALL',auth=token,extra='')=>call('get',`/collections/installments?loanId=${loan._id}&scope=${scope}&page=1&limit=100${extra}`,auth).then(r=>ok(r));
async function issue(daysAgo=5){const n=++serial,c=await Customer.create({customerCode:'CUS-SEQ-'+n,name:'Synthetic sequence customer '+n,employeeId:employee._id,createdBy:employee._id,fatherName:'Synthetic',mobile:String(9200000000+n),age:35,occupation:'Test',address:'Test only',city:'Test',area:'Sequence'});const loan=await createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-daysAgo)},{id:String(employee._id),role:'EMPLOYEE'});return {loan,rows:await Schedule.find({loanId:loan._id}).sort({dayNumber:1})};}
async function day3(){const fixture=await issue();ok(await pay(fixture.rows[0],1400),201);return fixture;}
const financial=async()=>JSON.stringify(await Promise.all([Loan,Schedule,Collection,require('../../src/models/CollectionPosition'),require('../../src/models/EmployeeSettlement'),require('../../src/models/CashBook')].map(m=>m.find().sort({_id:1}).lean())));
beforeAll(async()=>{process.env.JWT_SECRET='isolated-sequence-tests';process.env.KYC_ENCRYPTION_KEY='75'.repeat(32);repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'strict_sequence_isolated'});admin=await Admin.create({name:'Synthetic Admin',email:'sequence-admin@example.test',password:'Isolated123!',phone:'9200000000'});employee=await Employee.create({name:'Synthetic Employee',employeeCode:'EMP-SEQ',email:'sequence-employee@example.test',password:'Isolated123!',phone:'9200000001',city:'Test',area:'Sequence',createdBy:admin._id});other=await Employee.create({name:'Other',employeeCode:'EMP-OTHER',email:'sequence-other@example.test',password:'Isolated123!',phone:'9200000002',city:'Test',area:'Sequence',createdBy:admin._id});token=generateToken(employee._id,'EMPLOYEE');adminToken=generateToken(admin._id,'ADMIN');otherToken=generateToken(other._id,'EMPLOYEE');});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});

test('Day 3 alone is collectible and all later days are locked in both portals and every scope/page',async()=>{
 const {loan,rows}=await day3();
 for(const auth of [token,adminToken]){const all=await list(loan,'ALL',auth);expect(all.rows.filter(r=>r.canCollect).map(r=>r.dayNumber)).toEqual([3]);expect(all.rows.slice(3).every(r=>r.collectionLocked&&r.nextCollectibleDayNumber===3)).toBe(true);expect(all.rows.slice(0,2).every(r=>r.hasPaymentHistory&&!r.collectionLocked)).toBe(true);expect(all.rows.slice(2).every(r=>!r.hasPaymentHistory)).toBe(true);
  for(const scope of ['TODAY','OVERDUE','UPCOMING']){const result=await list(loan,scope,auth);for(const row of result.rows)if(row.dayNumber>3)expect(row).toMatchObject({canCollect:false,collectionLocked:true,nextCollectibleScheduleId:String(rows[2]._id)});}
  const page=ok(await call('get',`/collections/installments?loanId=${loan._id}&scope=ALL&page=4&limit=1`,auth));expect(page.rows[0]).toMatchObject({dayNumber:4,canCollect:false,nextCollectibleDayNumber:3});
 }
 const customerSchedule=ok(await call('get',`/customer-portfolios/customers/${loan.customerId}/installments?scope=ALL&page=4&limit=1`,adminToken));expect(customerSchedule.rows[0]).toMatchObject({dayNumber:4,collectionLocked:true,nextCollectibleDayNumber:3});
});
test('partial Day 3 stays collectible with ₹400 remaining, then full payment unlocks Day 4',async()=>{
 const {loan,rows}=await day3();ok(await pay(rows[2],300),201);let result=await list(loan);expect(result.rows[2]).toMatchObject({canCollect:true,remainingAmount:400,displayStatus:'PARTIAL'});expect(result.rows[3]).toMatchObject({collectionLocked:true,nextCollectibleRemainingAmount:400});
 const rejected=await pay(rows[3],700);expect(rejected.status).toBe(409);expect(rejected.body.message).toContain('Day 3 has ₹400.00 remaining');ok(await pay(rows[2],400),201);result=await list(loan);expect(result.rows[2].remainingAmount).toBe(0);expect(result.rows[3].canCollect).toBe(true);expect(result.rows[4].collectionLocked).toBe(true);
});
test('₹1000 preview and receipt allocate ₹700 to Day 3 and ₹300 to Day 4 with accurate histories',async()=>{
 const {loan,rows}=await day3(),before=await financial();const quote=ok(await call('get',`/collections/installments/${rows[2]._id}/allocation-preview?amount=1000`));expect(quote.allocations.map(a=>[a.dayNumber,a.amount,a.remainingAfter])).toEqual([[3,700,0],[4,300,400]]);expect(await financial()).toBe(before);
 const received=addDays(businessDay(),-2),payment=ok(await pay(rows[2],1000,{paymentDate:received,backdateReason:'Synthetic previous field receipt'}),201);expect(payment.allocations.map(a=>[String(a.scheduleId),a.amount])).toEqual([[String(rows[2]._id),700],[String(rows[3]._id),300]]);
 const result=await list(loan);expect(result.rows.filter(r=>r.canCollect).map(r=>r.dayNumber)).toEqual([4]);expect(result.rows[4].collectionLocked).toBe(true);
 for(const [index,amount]of [[2,700],[3,300]]){const history=ok(await call('get',`/collections/installments/${rows[index]._id}/history`));expect(history.payments).toHaveLength(1);expect(history.payments[0].allocatedAmount).toBe(amount);}
 expect(ok(await call('get',`/collections/installments/${rows[4]._id}/history`)).payments).toEqual([]);
 const receipt=ok(await call('get','/collections/receipt/'+payment._id));expect(businessDay(receipt.date)).toBe(received);expect(businessDay(receipt.recordedAt)).toBe(businessDay());expect(receipt.allocations.map(a=>a.amount)).toEqual([700,300]);
});
test('₹1400 clears Days 3 and 4 and unlocks Day 5 without changing loan calculation rules',async()=>{const {loan,rows}=await day3();ok(await pay(rows[2],1400),201);const result=await list(loan);expect(result.rows.filter(r=>r.canCollect).map(r=>r.dayNumber)).toEqual([5]);expect((await Loan.findById(loan._id)).remainingAmount).toBe(18200);});
test('Employee, Admin and legacy direct API calls cannot bypass sequencing; rejected requests have no financial side effects',async()=>{
 const {rows}=await day3(),before=await financial();
 for(const auth of [token,adminToken]){expect((await pay(rows[4],700,{cashReceivedByEmployeeId:String(employee._id)},auth)).status).toBe(409);expect((await call('get',`/collections/installments/${rows[4]._id}/allocation-preview?amount=700`,auth)).status).toBe(409);}
 expect((await call('post','/collections').send({loanScheduleId:String(rows[4]._id),amountReceived:700,paymentMode:'CASH'})).status).toBe(409);
 expect((await pay(rows[2],700,{},otherToken)).status).toBe(403);expect((await call('get',`/collections/installments/${rows[2]._id}/allocation-preview?amount=700`,otherToken)).status).toBe(403);expect((await request(app).post('/api/v1/collections').send({loanScheduleId:String(rows[2]._id),amountReceived:700,paymentMode:'CASH'})).status).toBe(401);expect(await financial()).toBe(before);
});
test('concurrent requests and idempotent retries never double-credit or skip an unpaid installment',async()=>{
 const {loan,rows}=await day3(),idem=key();const duplicate=await Promise.all([pay(rows[2],700,{idempotencyKey:idem}),pay(rows[2],700,{idempotencyKey:idem})]);duplicate.forEach(r=>ok(r,201));expect(duplicate[0].body.data._id).toBe(duplicate[1].body.data._id);
 const race=await Promise.all([pay(rows[3],700),pay(rows[3],700),pay(rows[5],700)]);expect(race.map(r=>r.status).sort()).toEqual([201,400,409]);expect(await Collection.countDocuments({loanId:loan._id})).toBe(3);expect((await Loan.findById(loan._id)).paidAmount).toBe(2800);expect((await list(loan)).rows.filter(r=>r.canCollect).map(r=>r.dayNumber)).toEqual([5]);
});
test('existing multi-installment advances remain allowed, overpayment/future-date restrictions remain enforced',async()=>{
 const {loan,rows}=await issue(0);expect((await pay(rows[2],700)).status).toBe(409);const quote=ok(await call('get',`/collections/installments/${rows[0]._id}/allocation-preview?amount=2100`));expect(quote.allocations.map(a=>a.dayNumber)).toEqual([1,2,3]);ok(await pay(rows[0],2100),201);
 const upcoming=await list(loan,'UPCOMING');expect(upcoming.rows.slice(0,3).every(r=>r.displayStatus==='PAID_EARLY')).toBe(true);expect(upcoming.rows[3].canCollect).toBe(true);expect((await pay(rows[3],20000)).status).toBe(422);expect((await pay(rows[3],700,{paymentDate:addDays(businessDay(),1)})).status).toBe(422);
});
test('sequence is isolated per loan and a misleading PAID label does not unlock later days or block actual debt',async()=>{
 const a=await day3(),b=await issue();await Schedule.updateOne({_id:a.rows[2]._id},{$set:{status:'PAID'}});expect((await list(a.loan)).rows.filter(r=>r.canCollect).map(r=>r.dayNumber)).toEqual([3]);expect((await pay(a.rows[3],700)).status).toBe(409);ok(await pay(a.rows[2],700),201);ok(await pay(b.rows[0],700),201);expect((await list(b.loan)).rows.filter(r=>r.canCollect).map(r=>r.dayNumber)).toEqual([2]);
});
test('a reopened installment balance recalculates the lock; stale allocation quotes never authorize a save',async()=>{
 const {loan,rows}=await day3();ok(await pay(rows[2],700),201);ok(await call('get',`/collections/installments/${rows[3]._id}/allocation-preview?amount=700`));
 // Isolated fixture representing a previously reviewed balance correction. No reversal API is added.
 await mongoose.connection.transaction(async session=>{await Schedule.updateOne({_id:rows[2]._id},{$set:{paidAmount:300,status:'PARTIAL'}},{session});await Loan.updateOne({_id:loan._id},{$inc:{paidAmount:-400,remainingAmount:400}},{session});});
 const result=await list(loan);expect(result.rows[2]).toMatchObject({canCollect:true,remainingAmount:400});expect(result.rows[3]).toMatchObject({canCollect:false,collectionLocked:true});expect((await pay(rows[3],700)).status).toBe(409);
});

test('₹800 context and next ₹750 reconcile without duplicate funds',async()=>{
 const {loan,rows}=await issue(0);ok(await pay(rows[0],700),201);const idem=key(),payment=ok(await pay(rows[1],800,{idempotencyKey:idem}),201);ok(await pay(rows[1],800,{idempotencyKey:idem}),201);
 for(const auth of [token,adminToken]){const all=await list(loan,'ALL',auth);expect(all.rows[1]).toMatchObject({paidAmount:700,remainingAmount:0});expect(all.rows[2]).toMatchObject({paidAmount:100,remainingAmount:600,displayStatus:'PARTIAL_EARLY'});for(const [index,amount] of [[1,700],[2,100]]){const h=ok(await call('get',`/collections/installments/${rows[index]._id}/history`,auth));expect(h.payments[0]).toMatchObject({receiptTotal:800,allocatedAmount:amount,totalAllocated:800,unallocatedAmount:0,collectedByName:employee.name});expect(h.payments[0].otherAllocations).toHaveLength(1);}}
 const receipt=ok(await call('get','/collections/receipt/'+payment._id));expect(receipt).toMatchObject({amount:800,totalAllocated:800,unallocatedAmount:0,currentLoanOutstanding:19500});const before=await financial();ok(await call('post','/collections/receipt/'+payment._id+'/verify',adminToken).send({remarks:'Synthetic review'}));expect(await financial()).toBe(before);
 expect(await require('../../src/models/CollectionPosition').countDocuments({collectionId:payment._id})).toBe(1);const cash=await require('../../src/models/CashBook').find({'entries.referenceId':payment._id}).lean();expect(cash.flatMap(b=>b.entries).filter(e=>String(e.referenceId)===String(payment._id)).map(e=>e.cashIn)).toEqual([800]);
 const quote=ok(await call('get',`/collections/installments/${rows[2]._id}/allocation-preview?amount=750`));expect(quote.allocations.map(a=>[a.dayNumber,a.amount,a.remainingAfter])).toEqual([[3,600,0],[4,150,550]]);expect(quote.nextInstallment).toEqual({dayNumber:4,remainingAmount:550});ok(await pay(rows[2],750),201);expect((await Loan.findById(loan._id)).remainingAmount).toBe(18750);
});
