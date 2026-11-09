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
const pay=(row,amount,extra={},auth=token)=>call('post','/collections',auth).send({loanScheduleId:String(row._id),amountReceived:amount,paymentMode:'CASH',financeVersion:2,idempotencyKey:key(),...extra});
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
test('server-paginated installment lists retain full filtered totals and ownership',async()=>{
 const loan=await issue(0),rows=await schedules(loan);ok(await pay(rows[0],2100),201);
 const first=ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}&page=1&limit=10`)),second=ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}&page=2&limit=10`));
 expect(first.meta).toMatchObject({total:30,totalPages:3,page:1});expect(first.rows).toHaveLength(10);expect(second.rows[0].dayNumber).toBe(11);expect(first.remainingAmount).toBe(18900);expect(second.remainingAmount).toBe(18900);expect(first.rows[0].displayStatus).toBe('PAID_EARLY');
 expect(ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}&page=1&limit=10`,otherToken)).meta.total).toBe(0);
 expect(ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}&page=1&limit=10&search=%5E.*`)).meta.total).toBe(0);
 expect((await call('get','/collections/installments?scope=ALL&page=1&limit=1000')).status).toBe(422);
});

test('backdated issuance retains actual issue and current entry date for Employee and Admin',async()=>{
 for(const byAdmin of [false,true]){const loan=await issue(4,byAdmin),rows=await schedules(loan);expect(businessDay(loan.loanDate)).toBe(addDays(businessDay(),-4));expect(businessDay(loan.createdAt)).toBe(businessDay());expect(businessDay(rows[0].date)).toBe(addDays(businessDay(),-3));expect(rows).toHaveLength(30);expect(rows.reduce((n,r)=>n+r.amount,0)).toBe(21000);}
});

test('past receipts and a later combined payment cover four due dates without inventing a missed-day receipt',async()=>{
 const loan=await issue(),rows=await schedules(loan),today=businessDay();
 const a=ok(await pay(rows[0],700,{paymentDate:addDays(today,-3),backdateReason:'Received then; entry was delayed'}),201);
 const b=ok(await pay(rows[1],700,{paymentDate:addDays(today,-2),backdateReason:'Received then; entry was delayed'}),201);
 expect(await Collection.countDocuments({loanId:loan._id})).toBe(2);
 let overdue=ok(await call('get',`/collections/installments?scope=OVERDUE&loanId=${loan._id}`));expect(overdue.map(r=>r.dayNumber)).toEqual([3]);
 const c=ok(await pay(rows[2],1400,{paymentDate:today}),201);expect(c.allocations.map(a=>a.amount)).toEqual([700,700]);
 const all=ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}`));expect(all.slice(0,4).map(r=>r.displayStatus)).toEqual(['PAID_ON_TIME','PAID_ON_TIME','PAID_LATE','PAID_ON_TIME']);
 expect(all.slice(0,4).every(r=>!r.canCollect)).toBe(true);expect(await Collection.countDocuments({loanId:loan._id})).toBe(3);
 expect(await Collection.countDocuments({loanId:loan._id,status:'MISSED'})).toBe(0);expect((await Loan.findById(loan._id)).remainingAmount).toBe(18200);
 const receipt=ok(await call('get',`/collections/receipt/${c._id}`));expect(receipt.allocations.map(a=>businessDay(a.dueDate))).toEqual([addDays(today,-1),today]);expect(receipt.allocations.map(a=>a.timing)).toEqual(['PAID_LATE','PAID_ON_TIME']);
 expect(businessDay(a.paymentDate)).toBe(addDays(today,-3));expect(businessDay(a.createdAt)).toBe(today);expect(businessDay(b.createdAt)).toBe(today);
 const audit=await Audit.findOne({action:'PAYMENT_RECEIVED',referenceId:a._id});expect(audit.newValue.backdateReason).toBe('Received then; entry was delayed');expect(businessDay(audit.createdAt)).toBe(today);
 const report=await reports.getExportData('collections',{startDate:addDays(today,-3),endDate:addDays(today,-3)});const exported=report.find(r=>r.loanNumber===loan.loanNumber);expect(exported.receivedAmount).toBe(700);expect(exported.installmentsCovered).toContain(addDays(today,-3));expect(businessDay(exported.recordedAt)).toBe(today);
 overdue=ok(await call('get',`/collections/installments?scope=OVERDUE&loanId=${loan._id}`));expect(overdue).toHaveLength(0);
});

test('one advance receipt pays next three future installments and remains Paid Early after the due date',async()=>{
 const loan=await issue(0),rows=await schedules(loan),before=await Collection.countDocuments();const receipt=ok(await pay(rows[0],2100),201);
 expect(receipt.allocations).toHaveLength(3);expect(await Collection.countDocuments()).toBe(before+1);expect(await Position.countDocuments({collectionId:receipt._id})).toBe(1);
 const upcoming=ok(await call('get',`/collections/installments?scope=UPCOMING&loanId=${loan._id}`));expect(upcoming).toHaveLength(30);expect(upcoming.slice(0,3).map(r=>r.displayStatus)).toEqual(['PAID_EARLY','PAID_EARLY','PAID_EARLY']);expect(upcoming[0].statusLabel).toContain('Paid in Advance');expect(upcoming[0].canCollect).toBe(false);
 const {present}=require('../../src/utils/installmentStatus');expect(present(upcoming[0],dayStart(addDays(businessDay(),1))).displayStatus).toBe('PAID_EARLY');
 expect((await pay(rows[0],700)).status).toBe(400);
 const history=ok(await call('get',`/collections/history/${loan._id}`));expect(history).toHaveLength(1);expect(history[0].allocations).toHaveLength(3);
});

test('partial advance payments reconcile in paise and complete only the unpaid amount',async()=>{
 const loan=await issue(0),row=(await schedules(loan))[0];ok(await pay(row,200),201);
 let upcoming=ok(await call('get',`/collections/installments?scope=UPCOMING&loanId=${loan._id}`));expect(upcoming[0]).toMatchObject({displayStatus:'PARTIAL_EARLY',paidAmount:200,remainingAmount:500,canCollect:true});
 ok(await pay(row,500),201);upcoming=ok(await call('get',`/collections/installments?scope=UPCOMING&loanId=${loan._id}`));expect(upcoming[0]).toMatchObject({displayStatus:'PAID_EARLY',paidAmount:700,remainingAmount:0,canCollect:false});expect((await Loan.findById(loan._id)).paidAmount).toBe(700);
});

test('dates, reasons, assignment and Admin cash custody are validated with no failed-write side effects',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],before=await Collection.countDocuments();
 const invalidLoanDate=await call('post','/loans').send({customerId:String(loan.customerId),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:'2026-02-30T00:00:00Z'});expect(invalidLoanDate.status).toBe(400);expect(invalidLoanDate.body.message).toBe('Validation failed');expect(invalidLoanDate.body.errors.some(e=>e.path==='loanDate')).toBe(true);
 for(const extra of [{paymentDate:addDays(businessDay(),1)},{paymentDate:'2026-02-30',backdateReason:'Calendar error test'},{paymentDate:addDays(businessDay(),-5),backdateReason:'Before loan issue test'},{paymentDate:addDays(businessDay(),-1)},{paymentDate:addDays(businessDay(),-1),backdateReason:'   '}])expect((await pay(row,700,extra)).status).toBe(422);
 expect((await pay(row,700,{},otherToken)).status).toBe(403);expect((await pay(row,700,{},adminToken)).status).toBe(422);expect(await Collection.countDocuments()).toBe(before);
 const receipt=ok(await pay(row,700,{paymentDate:addDays(businessDay(),-3),backdateReason:'Admin recording verified historic receipt',cashReceivedByEmployeeId:String(employee._id)},adminToken),201);expect(receipt.recordedByRole).toBe('ADMIN');
});

test('scopes enforce roles and distinguish paid, overdue, today and future without changing dates',async()=>{
 const loan=await issue(),rows=await schedules(loan),dates=rows.map(r=>r.date.toISOString());
 expect(ok(await call('get',`/collections/installments?scope=TODAY&loanId=${loan._id}`)).map(r=>r.dayNumber)).toEqual([4]);
 expect(ok(await call('get',`/collections/installments?scope=OVERDUE&loanId=${loan._id}`,adminToken))).toHaveLength(3);
 expect(ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}`,otherToken))).toHaveLength(0);
 expect((await call('get',`/collections/installments?scope=ALL&employeeId=${employee._id}`,otherToken)).status).toBe(403);
 expect((await call('get','/collections/installments?scope=INVALID')).status).toBe(422);expect((await call('get','/collections/installments?scope=ALL&loanId=bad')).status).toBe(422);
 expect((await schedules(loan)).map(r=>r.date.toISOString())).toEqual(dates);
});

test('backfilling a partial payment cannot rewrite entry timestamps or move the latest receipt date backwards',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],today=businessDay(),due=businessDay(row.date);
 ok(await pay(row,2800+200,{paymentDate:today}),201);
 const nextRow=(await schedules(loan))[4];
 const oldEntry=ok(await pay(nextRow,500,{paymentDate:due,backdateReason:'Earlier partial receipt entered after reconciliation',createdAt:'2000-01-01T00:00:00Z',recordedAt:'2000-01-01T00:00:00Z',allocations:[{amount:999999}]}),201);
 expect(businessDay(oldEntry.createdAt)).toBe(today);expect(oldEntry.allocations[0].amount).toBe(500);
 const updated=await Loan.findById(loan._id);expect(updated.createdAt).toEqual(loan.createdAt);expect(businessDay(updated.lastPaymentDate)).toBe(today);
 const all=ok(await call('get',`/collections/installments?scope=ALL&loanId=${loan._id}`));expect(all[0]).toMatchObject({displayStatus:'PAID_LATE',paidAmount:700,canCollect:false});expect(businessDay(all[0].paidDate)).toBe(today);
});

test('idempotency includes actual receipt date and reason and concurrent submissions cannot double collect',async()=>{
 const loan=await issue(),row=(await schedules(loan))[0],idempotencyKey=key(),extra={idempotencyKey,paymentDate:addDays(businessDay(),-3),backdateReason:'Historic receipt entered after field visit'};
 const first=ok(await pay(row,700,extra),201),retry=ok(await pay(row,700,extra),201);expect(retry._id).toBe(first._id);expect((await pay(row,700,{...extra,paymentDate:addDays(businessDay(),-2)})).status).toBe(409);expect((await pay(row,700,{...extra,backdateReason:'Another reason'})).status).toBe(409);
 const next=(await schedules(loan))[1],responses=await Promise.all([pay(next,2100),pay(next,2100)]);expect(responses.map(r=>r.status).sort()).toEqual([201,400]);expect(await Collection.countDocuments({loanId:loan._id})).toBe(2);
});

test('backdated cash/digital custody retains entry timestamps, reports actual receipt dates and settles only once',async()=>{
 const loan=await issue(),rows=await schedules(loan),past=addDays(businessDay(),-3),backdateReason='Cash and UPI received during field visit';
 const cash=ok(await pay(rows[0],700,{paymentDate:past,backdateReason}),201);
 const digital=ok(await pay(rows[1],700,{paymentDate:past,backdateReason,paymentMode:'UPI',receivingAccountId:String(employeeUpi._id),transactionReference:'DATED-UPI-0001'}),201);
 const company=ok(await pay(rows[2],700,{paymentDate:past,backdateReason,paymentMode:'UPI',receivingAccountId:String(companyUpi._id),transactionReference:'DATED-COMPANY-0001'}),201);
 const positions=await Position.find({collectionId:{$in:[cash._id,digital._id,company._id]}});expect(positions.every(p=>businessDay(p.paymentDate)===past&&businessDay(p.recordedAt)===businessDay())).toBe(true);
 const dash=ok(await call('get',`/settlements/dashboard?from=${past}&to=${past}`));expect(dash.payments.filter(p=>[cash._id,digital._id,company._id].includes(p.collectionId._id))).toHaveLength(3);
 expect(dash.payments.every(p=>p.recordedAt)).toBe(true);
 // Custody allocates oldest receipts first. Handover all available cash to include this new backdated receipt too.
 const body={kind:'CASH',amount:dash.totals.availableCashMinor/100,accountId:String(companyCash._id),occurredAt:new Date().toISOString(),idempotencyKey:key(),remarks:'Actual handover after backdated receipts'};
 const submitted=ok(await call('post','/settlements').send(body),201),retry=ok(await call('post','/settlements').send(body),201);expect(submitted._id).toBe(retry._id);
 expect((await Position.findOne({collectionId:cash._id})).reservedMinor).toBe(70000);
 const before=(await Loan.findById(loan._id)).paidAmount;ok(await call('post',`/settlements/${submitted._id}/review`,adminToken).send({action:'reject',version:submitted.version,remarks:'Synthetic test; release custody reservation'}));expect((await Position.findOne({collectionId:cash._id})).reservedMinor).toBe(0);expect((await Loan.findById(loan._id)).paidAmount).toBe(before);
});
