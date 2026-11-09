const mongoose=require('mongoose'),request=require('supertest');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection'),Position=require('../../src/models/CollectionPosition'),CashBook=require('../../src/models/CashBook');
const {createLoanService}=require('../../src/services/loan.service');
const {generateToken}=require('../../src/utils/jwt');
const {legacyMinor}=require('../../src/utils/money');
const {businessDay,addDays,dayStart}=require('../../src/utils/businessDay');
const reports=require('../../src/repositories/report.repository');
const repair=require('../../src/services/scheduleRepair.service');
jest.setTimeout(180000);
let repl,admin,employee,other,adminToken,token,otherToken,serial=0,overdueLoan;
const actor=()=>({id:String(employee._id),role:'EMPLOYEE'});
const call=(method,url,auth=token)=>request(app)[method]('/api/v1'+url).set('Authorization','Bearer '+auth);
const ok=(res,status=200)=>{if(res.status>=500)console.error(require('../../src/utils/logger').logError.mock.calls.at(-1)?.[1]?.stack);expect({status:res.status,body:res.body}).toMatchObject({status});return res.body.data;};
async function customer(){const n=++serial;return Customer.create({customerCode:'CUS-FIN-'+n,name:'Synthetic finance customer',employeeId:employee._id,createdBy:employee._id,fatherName:'Synthetic',mobile:String(9000000000+n),age:35,occupation:'Test',address:'Synthetic only',city:'Test',area:'Financial audit'});}
async function issue(overrides={}){const c=await customer();return createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-90),...overrides},actor());}
// Explicit synthetic issue-date receipts preserve coverage of historical partial balances.
async function pay(schedule,amount,overrides={}){const fixtureLoan=await Loan.findById(schedule.loanId);return call('post','/collections').send({paymentDate:businessDay(fixtureLoan.loanDate),backdateReason:'Synthetic issue-date advance receipt',loanScheduleId:String(schedule._id),amountReceived:amount,paymentMode:'CASH',financeVersion:2,idempotencyKey:require('crypto').randomBytes(16).toString('hex'),...overrides});}
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-financial-workflow';process.env.KYC_ENCRYPTION_KEY='61'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'financial_workflow_isolated'});
 admin=await Admin.create({name:'Synthetic Admin',email:'finance-admin@example.test',password:'Isolated123!',phone:'9000000000'});
 employee=await Employee.create({employeeCode:'EMP-FIN-A',name:'Synthetic Employee',email:'finance-employee@example.test',password:'Isolated123!',phone:'9000000001',city:'Test',area:'Financial audit',createdBy:admin._id});
 other=await Employee.create({employeeCode:'EMP-FIN-B',name:'Other synthetic employee',email:'finance-other@example.test',password:'Isolated123!',phone:'9000000002',city:'Test',area:'Other',createdBy:admin._id});
 adminToken=generateToken(admin._id,'ADMIN');token=generateToken(employee._id,'EMPLOYEE');otherToken=generateToken(other._id,'EMPLOYEE');
});
afterAll(async()=>{await mongoose.disconnect();if(repl)await repl.stop();});

test('new loans have exact flat interest, next-day IST schedules and paise-correct final installments',async()=>{
 overdueLoan=await issue();const rows=await Schedule.find({loanId:overdueLoan._id}).sort({dayNumber:1});
 expect(overdueLoan).toMatchObject({interestAmount:1000,totalPayable:21000,dailyInstallment:700,remainingAmount:21000});expect(rows).toHaveLength(30);
 expect(businessDay(rows[0].date)).toBe(addDays(businessDay(overdueLoan.loanDate),1));expect(rows.at(-1).date).toEqual(overdueLoan.maturityDate);
 const rounded=await issue({loanAmount:'9999',interestPercent:'2.5'}),schedule=await Schedule.find({loanId:rounded._id});
 expect(schedule.reduce((n,s)=>n+legacyMinor(s.amount),0)).toBe(legacyMinor(rounded.totalPayable));
 expect(rounded.interestAmount).toBe(249.98);
});
test('matured zero-payment loan remains overdue and collectable without writing missed payments or alerts',async()=>{
 const before=await Collection.countDocuments();const rows=ok(await call('get','/collections/today')).filter(r=>r.loanNumber===overdueLoan.loanNumber);
 expect(rows).toHaveLength(30);expect(rows.every(r=>r.overdue&&r.loanRemainingAmount===21000)).toBe(true);
 const details=ok(await call('get',`/loans/${overdueLoan._id}`));expect(details).toMatchObject({status:'ACTIVE',effectiveStatus:'OVERDUE',overdueAmount:21000,canCollect:true});
 const alerts=ok(await call('get','/notifications',adminToken));expect(alerts.filter(r=>String(r.loanId)===String(overdueLoan._id))).toHaveLength(30);
 expect(await Collection.countDocuments()).toBe(before);expect(await require('../../src/models/Notification').countDocuments()).toBe(0);
});
test('partial and advance payments recover arrears in order; selecting the last schedule cannot skip earlier dues',async()=>{
 const schedules=await Schedule.find({loanId:overdueLoan._id}).sort({dayNumber:1});
 ok(await pay(schedules[0],'200.00'),201);expect((await Loan.findById(overdueLoan._id)).paidDays).toBe(0);
 expect((await pay(schedules.at(-1),'1400.00')).status).toBe(409);
 ok(await pay(schedules[0],'1400.00'),201);
 const state=await Loan.findById(overdueLoan._id);expect(state.paidAmount).toBe(1600);expect(state.remainingAmount).toBe(19400);expect(state.paidDays).toBe(2);
 expect(ok(await call('get',`/loans/${state._id}`)).overdueAmount).toBe(19400);
 const history=ok(await call('get',`/collections/history/${state._id}`));expect(history).toHaveLength(2);
  expect(ok(await call('get',`/collections/receipt/${history[0]._id}`)).loanId).toBe(String(state._id));
 expect((await call('get',`/collections/history/${state._id}`,otherToken)).status).toBe(403);
 expect((await call('get',`/loans/${state._id}/timeline`,otherToken)).status).toBe(404);
});
test('duplicate retry records money once and overpayment rolls back collection, custody and cash book',async()=>{
 const row=await Schedule.findOne({loanId:overdueLoan._id,$expr:{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}}).sort({dayNumber:1});const key='financial-retry-key-00000000001';
 const first=ok(await pay(row,100,{idempotencyKey:key}),201),second=ok(await pay(row,100,{idempotencyKey:key}),201);expect(second._id).toBe(first._id);
 const before=await Collection.countDocuments(),positions=await Position.countDocuments(),paid=(await Loan.findById(overdueLoan._id)).paidAmount;
 expect((await pay(row,999999)).status).toBe(422);expect(await Collection.countDocuments()).toBe(before);expect(await Position.countDocuments()).toBe(positions);expect((await Loan.findById(overdueLoan._id)).paidAmount).toBe(paid);
});
test('full repayment completes rounded loan by actual schedule count and removes it from overdue views',async()=>{
 const loan=await issue({loanAmount:'9999',interestPercent:'2.5'}),row=await Schedule.findOne({loanId:loan._id});
 ok(await pay(row,loan.totalPayable),201);const paid=await Loan.findById(loan._id);
 expect(paid.status).toBe('COMPLETED');expect(paid.remainingAmount).toBe(0);expect(paid.remainingDays).toBe(0);expect(paid.paidDays).toBe(30);
 expect(ok(await call('get','/collections/today')).some(r=>r.loanNumber===loan.loanNumber)).toBe(false);
 expect(ok(await call('get','/notifications',adminToken)).some(r=>String(r.loanId)===String(loan._id))).toBe(false);
 ok(await call('patch',`/loans/${loan._id}/status`,adminToken).send({status:'CLOSED'}));
 expect((await pay(row,1)).status).toBe(400);
 expect((await call('patch',`/loans/${overdueLoan._id}/status`,adminToken).send({status:'CLOSED'})).status).toBe(409);
});
test('defaulted debt remains recoverable; inactive/foreign employees cannot receive it',async()=>{
 const loan=await issue();ok(await call('patch',`/loans/${loan._id}/status`,adminToken).send({status:'DEFAULTED'}));const row=await Schedule.findOne({loanId:loan._id});
 expect((await call('post','/collections',otherToken).send({loanScheduleId:String(row._id),amountReceived:10,paymentMode:'CASH'})).status).toBe(403);
 ok(await pay(row,10),201);expect((await Loan.findById(loan._id)).remainingAmount).toBe(20990);
});
test('reports and dashboards use actual receipt dates and IST filters rather than original overdue dates',async()=>{
 const dashboard=ok(await call('get','/dashboard/employee'));const payments=(await Collection.find({employeeId:employee._id,amountReceived:{$gt:0}})).filter(p=>businessDay(p.paymentDate)===businessDay());
 const received=payments.reduce((n,c)=>n+legacyMinor(c.amountReceived),0)/100;expect(dashboard.todaysTotalCollection).toBe(received);expect(dashboard.myLoans).toBeGreaterThan(0);expect(dashboard.overdueAmount).toBeGreaterThan(0);
 const day=businessDay(),report=await reports.getCollectionReports({startDate:day,endDate:day,employeeId:String(employee._id)});expect(report.totalAmount).toBe(received);expect(report.totalCollections).toBe(payments.length);
 const daily=await reports.getDailyReports({startDate:day,endDate:day});expect((daily.find(r=>r.date===day)?.collectionAmount||0)).toBe(received);
 expect((await reports.getExportData('collections',{startDate:'2000-01-01',endDate:'2000-01-02'}))).toHaveLength(0);
 const exported=await reports.getExportData('collections',{startDate:day,endDate:day});expect(exported.reduce((n,r)=>n+legacyMinor(r.receivedAmount),0)/100).toBe(received);
 const books=await CashBook.find();const recovery=books.flatMap(b=>b.entries).filter(e=>e.type==='LOAN_RECOVERY');expect(recovery.reduce((n,e)=>n+legacyMinor(e.cashIn),0)/100).toBe((await Collection.find({employeeId:employee._id,amountReceived:{$gt:0}})).reduce((n,c)=>n+legacyMinor(c.amountReceived),0)/100);
});
test('concurrent loan issuance cannot create two outstanding loans for one approved customer',async()=>{
 const c=await customer(),payload={customerId:String(c._id),loanAmount:1000,interestPercent:5,durationDays:10,loanDate:businessDay()};
 const results=await Promise.allSettled([createLoanService(payload,actor()),createLoanService(payload,actor())]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(await Loan.countDocuments({customerId:c._id})).toBe(1);
});
test('reviewed rounding repair is explicit, audited, reversible, and rejects stale plans',async()=>{
 const loan=await issue({loanAmount:2000,interestPercent:3}),last=await Schedule.findOne({loanId:loan._id}).sort({dayNumber:-1});
 await Schedule.updateOne({_id:last._id},{$set:{amount:last.amount-0.05}});
 const plan=repair.planFor(await repair.snapshot(loan._id));expect(plan.action).toBe('ADJUST_UNPAID_FINAL_INSTALLMENT');expect(plan.difference).toBe(0.05);
  expect((await pay(await Schedule.findOne({loanId:loan._id}),loan.totalPayable)).status).toBe(409);
  expect(await Collection.countDocuments({loanId:loan._id})).toBe(0);
 const user={id:String(admin._id),role:'ADMIN'},applied=await repair.applyPlan(plan,user);expect((await Schedule.findById(last._id)).amount).toBe(last.amount);
 await expect(repair.applyPlan(plan,user)).rejects.toThrow(/stale|changed/);
 await repair.rollback(applied.auditId,user);expect((await Schedule.findById(last._id)).amount).toBe(last.amount-0.05);
 expect((await Loan.findById(loan._id)).paidAmount).toBe(0);expect(await Collection.countDocuments({loanId:loan._id})).toBe(0);
  const next=repair.planFor(await repair.snapshot(loan._id));await expect(repair.applyPlan(next,actor())).rejects.toMatchObject({status:403});
  const again=await repair.applyPlan(next,user);ok(await pay(await Schedule.findOne({loanId:loan._id}),1),201);
  await expect(repair.rollback(again.auditId,user)).rejects.toThrow(/changed/);
});

test('cash-book date reads include legacy midnight records without moving them',async()=>{
 const book=await CashBook.create({date:new Date('2020-01-02T00:00:00Z'),openingBalance:0,cashIn:0,cashOut:0,closingBalance:0,entries:[]});
 const cash=require('../../src/services/cashBook.service');
 expect(String((await cash.getCashBookDayService('2020-01-02'))._id)).toBe(String(book._id));
 expect((await cash.getCashBookListService({from:'2020-01-02',to:'2020-01-02'}))).toHaveLength(1);
 expect((await CashBook.findById(book._id)).date).toEqual(book.date);
});

test('receipt reporting honors India midnight and filters all exports consistently',async()=>{
 const loan=await issue(),row=await Schedule.findOne({loanId:loan._id});
 const a=ok(await pay(row,10),201),b=ok(await pay(row,10),201);
 await Collection.updateOne({_id:a._id},{$set:{paymentDate:new Date('2026-07-29T18:29:59.999Z')}});
 await Collection.updateOne({_id:b._id},{$set:{paymentDate:new Date('2026-07-29T18:30:00.000Z')}});
 const old=await reports.getCollectionReports({startDate:'2026-07-29',endDate:'2026-07-29'}),next=await reports.getCollectionReports({startDate:'2026-07-30',endDate:'2026-07-30'});
 expect(old.totalAmount).toBe(10);expect(next.totalAmount).toBe(10);
 expect((await reports.getExportData('collections',{startDate:'2026-07-29',endDate:'2026-07-29'}))).toHaveLength(1);
});
test('aggregated dashboards match authoritative reports without rewriting financial records',async()=>{
 const {load,sum}=require('../../src/repositories/financialReportData'),dashboard=require('../../src/repositories/dashboard.repository');
 for(const employeeId of [undefined,String(employee._id)]){
  const original=await load(employeeId?{employeeId}:{}),actual=employeeId?await dashboard.getEmployeeDashboardStats(employeeId):await dashboard.getAdminDashboardStats();
  const openIds=new Set(original.loans.filter(l=>['ACTIVE','DEFAULTED'].includes(l.status)).map(l=>String(l._id))),schedules=original.schedules.filter(s=>openIds.has(String(s.loanId))),today=schedules.filter(s=>businessDay(s.date)===original.today),past=schedules.filter(s=>businessDay(s.date)<original.today&&s.amount>(s.paidAmount||0)),remaining=s=>Math.max(0,s.amount-(s.paidAmount||0)),received=original.collections.filter(c=>businessDay(c.paymentDate)===original.today);
  expect(actual.totalOutstanding).toBe(sum(original.loans,'remainingAmount'));expect(actual.todaysRevenue).toBe(sum(received,'amountReceived'));expect(actual.todaysCollection).toBe(received.length);expect(actual.overdueAmount).toBe(sum(past,remaining));expect(actual.overdueInstallments).toBe(past.length);expect(actual.dueTodayAmount).toBe(sum(today,remaining));expect(actual.todayExpectedAmount).toBe(sum(today,'amount'));
 }
});

test('portfolio filters/counts, next unpaid due and receipt totals are authorized read-only views',async()=>{
 const loan=await issue({loanDate:addDays(businessDay(),-4)}),schedule=await Schedule.findOne({loanId:loan._id,dayNumber:1});
 ok(await pay(schedule,800),201);
 const before=JSON.stringify(await Loan.findById(loan._id).lean());
 const list=await call('get','/loans?includeCounts=true&limit=1&customer='+loan.customerId+'&search='+loan.loanNumber.toLowerCase());
 const rows=ok(list);expect(rows).toHaveLength(1);expect(list.body.meta.counts).toEqual({all:1,active:1,closed:0,overdue:1});
 expect(rows[0].nextDueDay).toBe(2);expect(businessDay(rows[0].nextDueDate)).toBe(addDays(businessDay(loan.loanDate),2));
 const detail=ok(await call('get','/loans/'+loan._id));expect(detail.financialDisplay).toEqual({received:800,allocated:800,receiptCount:1});expect(detail.remainingAmount).toBe(20200);
 expect(JSON.stringify(await Loan.findById(loan._id).lean())).toBe(before);
 const foreign=await call('get','/loans?includeCounts=true&customer='+loan.customerId,otherToken);expect(ok(foreign)).toEqual([]);expect(foreign.body.meta.counts.all).toBe(0);
 await call('get','/loans/'+loan._id,otherToken).expect(404);
 const mobile=await call('get','/loans?includeCounts=true&customer='+loan.customerId+'&search='+encodeURIComponent((await Customer.findById(loan.customerId)).mobile));expect(ok(mobile)).toHaveLength(1);
 const c=await customer();await Loan.create({loanNumber:'LN-TEST-COMPLETED',customerId:c._id,employeeId:employee._id,loanAmount:700,interestPercent:0,interestAmount:0,totalPayable:700,dailyInstallment:700,durationDays:1,loanDate:dayStart(addDays(businessDay(),-4)),maturityDate:dayStart(addDays(businessDay(),-3)),paidAmount:700,remainingAmount:0,paidDays:1,remainingDays:0,status:'COMPLETED',createdBy:employee._id});
 const closed=await call('get','/loans?includeCounts=true&status=CLOSED&customer='+c._id);expect(ok(closed)).toHaveLength(1);expect(closed.body.meta.counts.closed).toBe(1);
});

test('loan customer tab selects approved snapshot and excludes draft identity and documents',async()=>{
 const loan=await issue(),Lead=require('../../src/models/CustomerLead'),Document=require('../../src/models/KycDocument'),{encrypt}=require('../../src/utils/kycCrypto');
 const approved={name:'Approved synthetic customer',fatherName:'Approved Parent',mobile:'9876543230',address:'Approved Address',city:'Test',bankName:'Synthetic Bank',accountNumber:'123456789012',idProofNumber:'234567890123'};
 const lead=await Lead.create({kycVersion:1,submittedByEmployeeId:employee._id,customerId:loan.customerId,status:'DRAFT',kycEncrypted:encrypt(Buffer.from(JSON.stringify({...approved,name:'UNAPPROVED DRAFT NAME',accountNumber:'999999999999'}))),approvedKycEncrypted:encrypt(Buffer.from(JSON.stringify(approved))),approvedAt:new Date()});
 const bytes=require('fs').readFileSync(require('path').join(__dirname,'../fixtures/kyc-documents/photo.png'));
 const make=digest=>Document.create({leadId:lead._id,kind:'PHOTO',mime:'image/png',size:bytes.length,digest,encryptedBytes:encrypt(bytes),uploadedBy:employee._id});const approvedDoc=await make('approved-synthetic'),draftDoc=await make('draft-synthetic');
 lead.approvedDocumentIds=[approvedDoc._id];lead.documentIds=[draftDoc._id];await lead.save();await Customer.updateOne({_id:loan.customerId},{$set:{kycLeadId:lead._id}});
 const before=JSON.stringify(await Loan.findById(loan._id).lean()),result=ok(await call('get','/loans/'+loan._id+'/customer-profile'));
 expect(result.source).toBe('APPROVED_SNAPSHOT');expect(result.customer.name).toBe(approved.name);expect(result.customer.accountNumber).toBe('•••• 9012');expect(result.customer.idProofNumber).toBe('•••• 0123');expect(result.kyc.status).toBe('DRAFT');expect(result.kyc.documents.map(doc=>doc._id)).toEqual([String(approvedDoc._id)]);
 for(const forbidden of ['UNAPPROVED DRAFT NAME','123456789012','encryptedBytes',String(draftDoc._id)])expect(JSON.stringify(result)).not.toContain(forbidden);
 expect(ok(await call('get','/loans/'+loan._id+'/customer-profile',adminToken)).customer.name).toBe(approved.name);
 await call('get','/loans/'+loan._id+'/customer-profile',otherToken).expect(404);await request(app).get('/api/v1/loans/'+loan._id+'/customer-profile').expect(401);expect(JSON.stringify(await Loan.findById(loan._id).lean())).toBe(before);
});

test('receipt PDF is authorized A4 and preserves financial records',async()=>{
 const loan=await issue(),row=await Schedule.findOne({loanId:loan._id,dayNumber:1}),payment=ok(await pay(row,800),201);
 const snapshot=async()=>JSON.stringify(await Promise.all([Loan.findById(loan._id).lean(),Schedule.find({loanId:loan._id}).sort({dayNumber:1}).lean(),Collection.find({loanId:loan._id}).lean()]));const before=await snapshot();
 const result=await call('get','/collections/receipt/'+payment._id+'/pdf').expect(200);expect(result.headers['content-type']).toMatch(/application\/pdf/);expect(result.headers['cache-control']).toBe('no-store');expect(result.body.subarray(0,5).toString()).toBe('%PDF-');
 const pdf=await require('pdf-lib').PDFDocument.load(result.body);for(const page of pdf.getPages()){expect(page.getWidth()).toBeCloseTo(595.28,1);expect(page.getHeight()).toBeCloseTo(841.89,1);}
 require('fs').mkdirSync(require('path').resolve('../tmp/loan-tabs'),{recursive:true});require('fs').writeFileSync(require('path').resolve('../tmp/loan-tabs/receipt-test.pdf'),result.body);
 await call('get','/collections/receipt/'+payment._id+'/pdf',otherToken).expect(403);await request(app).get('/api/v1/collections/receipt/'+payment._id+'/pdf').expect(401);expect(await snapshot()).toBe(before);
});

test('grouped recovery opens oldest installment and one receipt reduces overdue exactly once',async()=>{const loan=await issue(),before=ok(await call('get','/collections/recovery')),group=before.rows.find(r=>r.loanId===String(loan._id));expect(group.totalCollectible).toBe(21000);expect(group.collectSchedule.dayNumber).toBe(1);const preview=ok(await call('get','/collections/installments/'+group.collectSchedule._id+'/allocation-preview?amount=1500'));expect(preview.allocations.map(a=>a.amount)).toEqual([700,700,100]);ok(await pay(group.collectSchedule,1500),201);const after=ok(await call('get','/collections/recovery')).rows.find(r=>r.loanId===String(loan._id));expect(after.totalCollectible).toBe(19500);expect(after.collectSchedule.dayNumber).toBe(3);expect(await Collection.countDocuments({loanId:loan._id})).toBe(1);const foreign=ok(await call('get','/collections/recovery',otherToken));expect(foreign.rows.some(r=>r.loanId===String(loan._id))).toBe(false);});

test('loan list filters actual issue dates by inclusive Asia/Kolkata days without changing records',async()=>{
 const day=addDays(businessDay(),-10),loan=await issue({loanDate:day});
 const before=JSON.stringify(await Loan.findById(loan._id).lean());
 const url='/loans?customer='+loan.customerId+'&employee='+employee._id+'&issuedFrom='+day+'&issuedTo='+day;
 const rows=ok(await call('get',url,adminToken));expect(rows.map(r=>String(r._id))).toEqual([String(loan._id)]);
 expect(ok(await call('get','/loans?customer='+loan.customerId+'&issuedFrom='+addDays(day,1),adminToken))).toEqual([]);
 expect(ok(await call('get','/loans?customer='+loan.customerId+'&issuedTo='+addDays(day,-1),adminToken))).toEqual([]);
 expect(ok(await call('get',url,otherToken))).toEqual([]);
 expect(ok(await call('get',url))).toHaveLength(1);
 expect(JSON.stringify(await Loan.findById(loan._id).lean())).toBe(before);
 for(const query of ['issuedFrom=2026-02-30','issuedTo=invalid','issuedFrom=2026-01-01&issuedFrom=2026-01-02','issuedFrom=2026-10-23&issuedTo=2026-10-22'])await call('get','/loans?'+query,adminToken).expect(422);
});

test('loan issue-date upper boundary includes the last millisecond of the India business day',async()=>{
 const day=addDays(businessDay(),-8),a=await issue({loanDate:day}),b=await issue({loanDate:addDays(day,1)});
 await Loan.updateOne({_id:a._id},{$set:{loanDate:new Date(dayStart(addDays(day,1)).getTime()-1)}});
 const before=JSON.stringify(await Loan.find({_id:{$in:[a._id,b._id]}}).sort({_id:1}).lean());
 const rows=ok(await call('get','/loans?issuedFrom='+day+'&issuedTo='+day,adminToken));
 expect(rows.some(r=>String(r._id)===String(a._id))).toBe(true);expect(rows.some(r=>String(r._id)===String(b._id))).toBe(false);
 expect(JSON.stringify(await Loan.find({_id:{$in:[a._id,b._id]}}).sort({_id:1}).lean())).toBe(before);
});

