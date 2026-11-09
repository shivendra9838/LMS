const mongoose=require('mongoose'),request=require('supertest');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app');
const Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection'),Position=require('../../src/models/CollectionPosition'),Audit=require('../../src/models/AuditLog');
const {createLoanService}=require('../../src/services/loan.service'),finance=require('../../src/services/settlement.service');
const {generateToken}=require('../../src/utils/jwt');
const {businessDay,addDays,dayStart}=require('../../src/utils/businessDay');
const reports=require('../../src/repositories/report.repository');
jest.setTimeout(180000);
let repl,admin,employee,other,adminToken,token,otherToken,companyCash,employeeUpi,companyUpi,serial=0;
const actor=()=>({id:String(employee._id),role:'EMPLOYEE'}),adminActor=()=>({id:String(admin._id),role:'ADMIN'});
const call=(method,url,auth=token)=>request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+auth);
const ok=(r,status=200)=>{if(r.status>=500)console.error(require('../../src/utils/logger').logError.mock.calls.at(-1)?.[1]?.stack);expect({status:r.status,body:r.body}).toMatchObject({status});return r.body.data;};
const key=()=>require('crypto').randomBytes(16).toString('hex');
async function issue(daysAgo=4,byAdmin=false){const n=++serial,c=await Customer.create({customerCode:'CUS-DATE-'+n,name:'Synthetic dated customer',employeeId:employee._id,createdBy:employee._id,fatherName:'Synthetic',mobile:String(9100000000+n),age:35,occupation:'Test',address:'Test only',city:'Test',area:'Dates'});return createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-daysAgo)},byAdmin?adminActor():actor());}
const schedules=loan=>Schedule.find({loanId:loan._id}).sort({dayNumber:1});
// Historical sequence/review fixtures use valid issue-date advances; due-date minimums have a dedicated API suite.
const pay=async(row,amount,extra={},auth=token)=>{const loan=await Loan.findById(row.loanId);return call('post','/collections',auth).send({paymentDate:businessDay(loan.loanDate),backdateReason:'Synthetic advance received on issue date',loanScheduleId:String(row._id),amountReceived:amount,paymentMode:'CASH',financeVersion:2,idempotencyKey:key(),...extra});};
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-dated-payments';process.env.KYC_ENCRYPTION_KEY='75'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'dated_payments_isolated'});
 admin=await Admin.create({name:'Synthetic Admin',email:'dated-admin@example.test',password:'Isolated123!',phone:'9100000000'});
 employee=await Employee.create({name:'Synthetic Employee',employeeCode:'EMP-DATED',email:'dated-employee@example.test',password:'Isolated123!',phone:'9100000001',city:'Test',area:'Dates',createdBy:admin._id});
 other=await Employee.create({name:'Other',employeeCode:'EMP-OTHER',email:'dated-other@example.test',password:'Isolated123!',phone:'9100000002',city:'Test',area:'Other',createdBy:admin._id});
 token=generateToken(employee._id,'EMPLOYEE');otherToken=generateToken(other._id,'EMPLOYEE');adminToken=generateToken(admin._id,'ADMIN');
 companyCash=await finance.createAccount({owner:'COMPANY',modes:['CASH'],label:'Synthetic company cash'},adminActor());
 employeeUpi=await finance.createAccount({owner:'EMPLOYEE',employeeId:String(employee._id),modes:['UPI'],label:'Synthetic employee UPI',details:'test-employee@synthetic.invalid'},adminActor());
 companyUpi=await finance.createAccount({owner:'COMPANY',modes:['UPI'],label:'Synthetic company UPI',details:'test-company@synthetic.invalid'},adminActor());
});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});

const Review=require('../../src/models/CustomerPaymentReview');
const verify=(payment,auth=adminToken)=>call('post','/collections/receipt/'+payment._id+'/verify',auth).send({});
const list=loan=>call('get','/collections/installments?scope=ALL&loanId='+loan._id,adminToken).then(r=>ok(r));
async function financialSnapshot(){const names=['Collection','Loan','LoanSchedule','CollectionPosition','CashBook','EmployeeSettlement'];return JSON.stringify(await Promise.all(names.map(name=>require('../../src/models/'+name).find({}).sort({_id:1}).lean())));}
test('awaiting collection cannot be verified; authentication and Admin-only review are enforced',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0];expect((await list(loan))[0].customerPaymentReview.status).toBe('AWAITING_EMPLOYEE_COLLECTION');
 expect((await verify({_id:row._id})).status).toBe(404);
 expect((await call('get','/collections/installments/'+row._id+'/payment-reviews',token)).status).toBe(403);
 expect((await call('get','/collections/installments/bad/payment-reviews',adminToken)).status).toBe(422);
 const payment=ok(await pay(row,200),201);expect((await verify(payment,token)).status).toBe(403);expect((await verify(payment,otherToken)).status).toBe(403);
 expect((await request(app).post('/api/v1/collections/receipt/'+payment._id+'/verify')).status).toBe(401);
});
test('partial receipts remain partial and each new receipt requires review without crediting balances twice',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],payment=ok(await pay(row,200),201);
 expect((await list(loan))[0]).toMatchObject({paidAmount:200,displayStatus:'PARTIAL',customerPaymentReview:{status:'PENDING_REVIEW',recordedAmount:200,verifiedAmount:0}});
 const before=await financialSnapshot();ok(await verify(payment));expect(await financialSnapshot()).toBe(before);
 expect((await list(loan))[0]).toMatchObject({paidAmount:200,displayStatus:'PARTIAL',customerPaymentReview:{status:'VERIFIED',verifiedAmount:200}});
 const details=ok(await call('get','/collections/installments/'+row._id+'/payment-reviews',adminToken));expect(details.remainingAmount).toBe(500);expect(details.payments[0].review.status).toBe('VERIFIED');
 const next=ok(await pay(row,500),201);expect((await list(loan))[0].customerPaymentReview.status).toBe('PENDING_REVIEW');ok(await verify(next));expect((await list(loan))[0].customerPaymentReview.status).toBe('VERIFIED');
});
test('one advance receipt verifies all allocations once; duplicate concurrent reviews have one audit and no financial writes',async()=>{
 const loan=await issue(0),row=(await schedules(loan))[0],payment=ok(await pay(row,2100),201),before=await financialSnapshot();
 const results=await Promise.all([verify(payment),verify(payment),verify(payment)]);results.forEach(r=>ok(r));expect(await Review.countDocuments({collectionId:payment._id})).toBe(1);expect(await Audit.countDocuments({action:'CUSTOMER_PAYMENT_VERIFIED',referenceId:String(payment._id)})).toBe(1);expect(await financialSnapshot()).toBe(before);
 expect((await list(loan)).slice(0,3).every(r=>r.customerPaymentReview.status==='VERIFIED')).toBe(true);
 expect((await Loan.findById(loan._id)).remainingAmount).toBe(18900);
});
test('backdated review preserves actual receipt and entry dates and does not verify company custody',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],payment=ok(await pay(row,700,{paymentDate:addDays(businessDay(),-3),backdateReason:'Synthetic previous field receipt'}),201),before=await financialSnapshot();ok(await verify(payment));expect(await financialSnapshot()).toBe(before);
 const receipt=ok(await call('get','/collections/receipt/'+payment._id));expect(receipt.date).toBe(payment.paymentDate);expect(receipt.recordedAt).toBe(payment.createdAt);expect(receipt.settlementStatus).toBe('UNSETTLED');
});
test('Admin-recorded and unattributable receipts cannot masquerade as employee collections',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],payment=ok(await pay(row,200,{cashReceivedByEmployeeId:String(employee._id)},adminToken),201);
 expect((await verify(payment)).status).toBe(409);expect((await list(loan))[0].customerPaymentReview.status).toBe('REQUIRES_HISTORY_REVIEW');
});

test('Day 1 history is allocation-scoped for both portals; unpaid Days 2-30 have no history',async()=>{
 const loan=await issue(),rows=await schedules(loan),payment=ok(await pay(rows[0],700,{paymentDate:addDays(businessDay(),-3),backdateReason:'Synthetic Day 1 field receipt'}),201);
 const before=await financialSnapshot();
 for(const auth of [token,adminToken]){
  const listed=ok(await call('get','/collections/installments?scope=ALL&loanId='+loan._id+'&page=1&limit=50',auth)).rows;
  expect(listed[0]).toMatchObject({paidAmount:700,hasPaymentHistory:true,paymentAllocationCount:1,allocatedPaidAmount:700});
  expect(listed.slice(1)).toHaveLength(29);expect(listed.slice(1).every(row=>row.paidAmount===0&&row.hasPaymentHistory===false&&row.paymentAllocationCount===0)).toBe(true);
  const first=ok(await call('get','/collections/installments/'+rows[0]._id+'/history',auth));
  expect(first).toMatchObject({paidAmount:700,allocatedPaidAmount:700,remainingAmount:0});
  expect(first.payments).toHaveLength(1);expect(String(first.payments[0]._id)).toBe(String(payment._id));expect(first.payments[0].allocatedAmount).toBe(700);expect(first.payments[0].paymentDate).toBe(payment.paymentDate);
  for(const index of [1,2,29]){const empty=ok(await call('get','/collections/installments/'+rows[index]._id+'/history',auth));expect(empty.payments).toEqual([]);expect(empty.remainingAmount).toBe(700);}
 }
 const wholeLoan=ok(await call('get','/collections/history/'+loan._id));expect(wholeLoan).toHaveLength(1);expect(wholeLoan[0]._id).toBe(String(payment._id));
 expect(await financialSnapshot()).toBe(before);
 expect((await call('get','/collections/installments/'+rows[0]._id+'/history',otherToken)).status).toBe(403);
 expect((await request(app).get('/api/v1/collections/installments/'+rows[0]._id+'/history')).status).toBe(401);
 expect((await call('get','/collections/installments/bad/history')).status).toBe(422);
 expect((await call('get','/collections/installments/'+new mongoose.Types.ObjectId()+'/history')).status).toBe(404);
});

test('advance receipt appears once per covered installment using only that allocation; partial remainder stays correct',async()=>{
 const loan=await issue(0),rows=await schedules(loan),payment=ok(await pay(rows[0],1650),201);
 for(const auth of [token,adminToken]){
  for(const [index,allocated,remaining]of [[0,700,0],[1,700,0],[2,250,450]]){
   const history=ok(await call('get','/collections/installments/'+rows[index]._id+'/history',auth));
   expect(history.payments).toHaveLength(1);expect(history.remainingAmount).toBe(remaining);expect(history.payments[0]).toMatchObject({_id:String(payment._id),amount:1650,allocatedAmount:allocated,timing:'PAID_EARLY'});
   if(index===2)expect(history.statusLabel).toBe('Partially Paid in Advance');
  }
  expect(ok(await call('get','/collections/installments/'+rows[3]._id+'/history',auth)).payments).toEqual([]);
 }
 const second=ok(await pay(rows[2],450),201);
 const history=ok(await call('get','/collections/installments/'+rows[2]._id+'/history'));
 expect(history.remainingAmount).toBe(0);expect(history.payments.map(p=>p.allocatedAmount).sort((a,b)=>a-b)).toEqual([250,450]);
 expect(new Set(history.payments.map(p=>p._id)).size).toBe(2);expect(history.payments.some(p=>p._id===String(second._id))).toBe(true);
});

test('legacy direct receipts stay on their exact schedule and do not fabricate later installment history',async()=>{
 const loan=await issue(),rows=await schedules(loan);
 // Synthetic legacy data is isolated; never repair configured customer records.
 await Schedule.updateOne({_id:rows[0]._id},{$set:{paidAmount:200,status:'PARTIAL'}});
 const receipt=await Collection.create({collectionNumber:'SYN-LEGACY-HISTORY-'+serial,loanId:loan._id,loanScheduleId:rows[0]._id,customerId:loan.customerId,employeeId:employee._id,collectedBy:employee._id,amountReceived:200,expectedAmount:700,paymentMode:'CASH',status:'PARTIAL'});
 const first=ok(await call('get','/collections/installments/'+rows[0]._id+'/history'));expect(first.payments[0]).toMatchObject({_id:String(receipt._id),allocatedAmount:200});expect(first.remainingAmount).toBe(500);
 expect(ok(await call('get','/collections/installments/'+rows[1]._id+'/history')).payments).toEqual([]);
});

test('receipt enrichment is read-only, allocation-specific and identical in both authorized portals',async()=>{
 const loan=await issue(0),rows=await schedules(loan),payment=ok(await pay(rows[0],1650,{transactionReference:'SYN-RECEIPT-REFERENCE'}),201),before=await financialSnapshot();
 for(const auth of [token,adminToken]){
  const receipt=ok(await call('get','/collections/receipt/'+payment._id,auth));
  expect(receipt).toMatchObject({amount:1650,currentLoanOutstanding:19350,receivedBy:{name:employee.name,employeeCode:employee.employeeCode,role:'EMPLOYEE'},customerPaymentReview:null,settlementStatus:'UNSETTLED'});
  expect(receipt.allocations.map(a=>[a.installmentNumber,a.installmentAmount,a.amount,a.currentPaidAmount,a.currentRemainingAmount])).toEqual([[1,700,700,700,0],[2,700,700,700,0],[3,700,250,250,450]]);
  expect(receipt.primaryInstallment.installmentNumber).toBe(1);expect(receipt.recordedAt).toBe(payment.createdAt);expect(new Date(receipt.generatedAt).getTime()).toBeGreaterThanOrEqual(new Date(payment.createdAt).getTime());
 }
 expect(await financialSnapshot()).toBe(before);
 expect((await call('get','/collections/receipt/'+payment._id,otherToken)).status).toBe(403);
 expect((await request(app).get('/api/v1/collections/receipt/'+payment._id)).status).toBe(401);
 expect((await call('get','/collections/receipt/invalid')).status).toBe(422);
});

test('later payments update only explicitly current receipt balances, preserving the original entry and allocations',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],payment=ok(await pay(row,200),201);
 const original=await Collection.findById(payment._id).lean();
 ok(await pay(row,500),201);
 const before=await financialSnapshot(),receipt=ok(await call('get','/collections/receipt/'+payment._id));
 expect(receipt.amount).toBe(200);expect(receipt.status).toBe('PARTIAL');expect(receipt.currentLoanOutstanding).toBe(20300);
 expect(receipt.allocations[0]).toMatchObject({amount:200,installmentAmount:700,currentPaidAmount:700,currentRemainingAmount:0});
 expect(await Collection.findById(payment._id).lean()).toEqual(original);expect(await financialSnapshot()).toBe(before);
});

test('Admin receipt identifies the actual Admin actor separately from the assigned employee',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],payment=ok(await pay(row,700,{cashReceivedByEmployeeId:String(employee._id)},adminToken),201);
 const receipt=ok(await call('get','/collections/receipt/'+payment._id,adminToken));
 expect(receipt.receivedBy).toMatchObject({name:admin.name,role:'ADMIN'});expect(receipt.employeeName).toBe(employee.name);expect(receipt.customerPaymentReview).toBeNull();expect(receipt.amount).toBe(700);
});


test('primary receipt context survives allocations, duplicate reviews preserve original verifier/time/remarks',async()=>{
 const loan=await issue(0),rows=await schedules(loan),payment=ok(await pay(rows[0],800),201);
 for(const auth of [token,adminToken]){const response=ok(await call('get','/collections/installments?scope=ALL&loanId='+loan._id,auth));const items=response.rows||response;expect(items[0].receiptSummaries[0]).toMatchObject({isPrimaryInstallment:true,receiptTotal:800,allocatedAmount:700});expect(items[1].receiptSummaries[0]).toMatchObject({isPrimaryInstallment:false,receiptTotal:800,allocatedAmount:100});expect(items[1].remainingAmount).toBe(600);}
 const first=ok(await call('post','/collections/receipt/'+payment._id+'/verify',adminToken).send({remarks:'Original review'}));
 const second=ok(await call('post','/collections/receipt/'+payment._id+'/verify',adminToken).send({remarks:'Must not overwrite'}));expect(second).toMatchObject({_id:first._id,verifiedAt:first.verifiedAt,verifiedBy:first.verifiedBy,remarks:'Original review'});
 expect(await Audit.countDocuments({action:'CUSTOMER_PAYMENT_VERIFIED',referenceId:String(payment._id)})).toBe(1);
 const reloaded=await list(loan);expect(reloaded.slice(0,2).every(r=>r.customerPaymentReview.status==='VERIFIED')).toBe(true);
});

test('authorized timeline derives one real receipt/review and denies another employee without financial writes',async()=>{
 const loan=await issue(0),rows=await schedules(loan);ok(await pay(rows[0],700),201);const payment=ok(await pay(rows[1],800),201);ok(await verify(payment));const before=await financialSnapshot();
 for(const auth of [adminToken,token]){const a=ok(await call('get','/loans/'+loan._id+'/timeline',auth));expect(a.filter(e=>e.type==='PAYMENT_RECEIVED')).toHaveLength(2);expect(a.find(e=>e.receiptId===String(payment._id)&&e.type==='PAYMENT_RECEIVED').title).toBe('₹800 Payment Received');expect(a.filter(e=>e.type==='PAYMENT_VERIFIED')).toHaveLength(1);expect(a.find(e=>e.type==='SCHEDULE_GENERATED').description).toBe('30 installments in the saved schedule');expect(a.find(e=>e.type==='LOAN_CREATED').target).toBe('LOAN');const again=ok(await call('get','/loans/'+loan._id+'/timeline',auth));expect(again).toEqual(a);}
 expect((await call('get','/loans/'+loan._id+'/timeline',otherToken)).status).toBe(404);expect(await financialSnapshot()).toBe(before);
});

test('Admin installment redesign totals and tab counts cover filtered records across pages without financial writes',async()=>{
 const loan=await issue(4),rows=await schedules(loan);ok(await pay(rows[0],800),201);
 const c=await Customer.findById(loan.customerId),base='/collections/installments?scope=ALL&includeSummary=true&page=1&limit=1&loanId='+loan._id+'&search='+c.mobile;
 const snapshot=async()=>JSON.stringify(await Promise.all([Loan.findById(loan._id).lean(),Schedule.find({loanId:loan._id}).sort({_id:1}).lean(),Collection.find({loanId:loan._id}).sort({_id:1}).lean(),Position.find({}).sort({_id:1}).lean()]));
 const before=await snapshot(),data=ok(await call('get',base,adminToken));
 expect(data.meta.total).toBe(30);expect(data.rows).toHaveLength(1);expect(data.rows[0].customerMobile).toBe(c.mobile);
 expect(data.summary).toEqual({amount:21000,paidAmount:800,remainingAmount:20200,total:30});expect(data.counts).toEqual({TODAY:1,OVERDUE:2,UPCOMING:26,ALL:30});
 const partial=ok(await call('get',base+'&paymentState=PARTIAL',adminToken));expect(partial.meta.total).toBe(1);expect(partial.rows[0].dayNumber).toBe(2);expect(partial.summary).toEqual({amount:700,paidAmount:100,remainingAmount:600,total:1});
 const paid=ok(await call('get',base+'&paymentState=PAID',adminToken));expect(paid.meta.total).toBe(1);expect(paid.rows[0].hasPaymentHistory).toBe(true);
 const empty=ok(await call('get',base.replace(c.mobile,'NO-MATCH'),adminToken));expect(empty.meta.total).toBe(0);expect(empty.summary.remainingAmount).toBe(0);
 expect(ok(await call('get',base,otherToken)).meta.total).toBe(0);
 expect((await call('get',base+'&employeeId='+other._id,token)).status).toBe(403);
 expect((await call('get',base+'&paymentState=INVALID',adminToken)).status).toBe(422);
 expect(await snapshot()).toBe(before);
});
