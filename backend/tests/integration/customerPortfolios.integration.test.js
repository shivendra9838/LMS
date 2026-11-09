const mongoose=require('mongoose'),request=require('supertest'),crypto=require('crypto');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Lead=require('../../src/models/CustomerLead'),Branch=require('../../src/models/Branch'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection'),Audit=require('../../src/models/AuditLog');
const {generateToken}=require('../../src/utils/jwt'),{businessDay,addDays}=require('../../src/utils/businessDay');
const {createLoanService}=require('../../src/services/loan.service');
jest.setTimeout(180000);
let repl,admin,employees,customers,adminToken,employeeToken,otherToken,oldLoan,advanceLoan,lead,branches,beforeFinancial;
const perf=[];
let queryPlanMetrics;
const call=(method,path,token=adminToken)=>request(app)[method]('/api/v1'+path).set('Authorization','Bearer '+token);
const read=async path=>{const start=performance.now(),r=await call('get','/customer-portfolios'+path);perf.push({path,milliseconds:Math.round(performance.now()-start)});expect(r.status).toBe(200);return r.body.data?.rows?{...r.body.data,meta:r.body.meta}:r.body;};
const fingerprint=async()=>{const out={};for(const name of ['loans','loanschedules','collections','collectionpositions','employeesettlements','paymentaccounts','cashbooks']){const raw=await mongoose.connection.db.collection(name).find({},{raw:true}).sort({_id:1}).toArray();out[name]=crypto.createHash('sha256').update(Buffer.concat(raw)).digest('hex');}return out;};
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-portfolio-test';process.env.KYC_ENCRYPTION_KEY='38'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'isolated_customer_portfolios'});
 admin=await Admin.create({name:'Synthetic Admin',email:'portfolio-admin@example.test',password:'Isolated123!',phone:'9100000000'});
 branches=await Branch.insertMany(['North','South'].map(name=>({name,areas:['Test'],createdBy:admin._id})));
 employees=[];for(let i=0;i<4;i++)employees.push(await Employee.create({name:['Alpha Employee','Beta Employee','Empty Employee','Inactive Employee'][i],employeeCode:'EMP-PORT-'+i,email:`portfolio-${i}@example.test`,password:'Isolated123!',phone:String(9100000100+i),city:'Test',area:'Test',branchId:branches[i%2]._id,status:i===3?'INACTIVE':'ACTIVE',createdBy:admin._id}));
 adminToken=generateToken(admin._id,'ADMIN');employeeToken=generateToken(employees[0]._id,'EMPLOYEE');otherToken=generateToken(employees[1]._id,'EMPLOYEE');
 customers=await Customer.insertMany(Array.from({length:1000},(_,i)=>({customerCode:'CUS-PORT-'+String(i).padStart(4,'0'),name:'Synthetic Customer '+String(i).padStart(4,'0'),mobile:String(9200000000+i),employeeId:employees[i<650?0:1]._id,createdBy:admin._id,fatherName:'Synthetic',age:35,occupation:'Test',address:'Isolated only',city:i%2?'North':'South',area:'Test',idProofNumber:'PRIVATE-IDENTITY-SENTINEL',status:i%10?'ACTIVE':'INACTIVE'})));
 // Legacy null, missing and dangling owners are intentionally inserted only in this disposable database.
 await Customer.collection.updateMany({_id:{$in:customers.slice(990,998).map(c=>c._id)}},{$set:{employeeId:null}});
 await Customer.collection.updateOne({_id:customers[998]._id},{$unset:{employeeId:1}});
 await Customer.collection.updateOne({_id:customers[999]._id},{$set:{employeeId:new mongoose.Types.ObjectId()}});
 const issue=async(index,ago)=>createLoanService({customerId:String(customers[index]._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-ago)},{id:String(employees[0]._id),role:'EMPLOYEE'});
 oldLoan=await issue(1,40);advanceLoan=await issue(2,0);
 // Historical completed fixture exercises multiple loans without bypassing the issuance rule forbidding two open loans.
 const historical=oldLoan.toObject();delete historical._id;delete historical.createdAt;delete historical.updatedAt;
 const completed=await Loan.create({...historical,loanNumber:'QA-HISTORICAL-COMPLETED',status:'COMPLETED',paidAmount:21000,remainingAmount:0,paidDays:30,remainingDays:0});
 const historySchedules=await Schedule.find({loanId:oldLoan._id}).lean();await Schedule.insertMany(historySchedules.map(row=>{const {_id,...values}=row;return {...values,loanId:completed._id,paidAmount:row.amount,paidDate:row.date,status:'PAID'};}));
 const row=await Schedule.findOne({loanId:advanceLoan._id}).sort({dayNumber:1});
 const paid=await call('post','/collections',employeeToken).send({loanScheduleId:String(row._id),amountReceived:2100,paymentMode:'CASH',financeVersion:2,idempotencyKey:crypto.randomBytes(16).toString('hex')});expect(paid.status).toBe(201);
 lead=await Lead.create({submittedByEmployeeId:employees[0]._id,assignedEmployeeId:employees[0]._id,customerId:customers[1]._id,name:customers[1].name,fatherName:'Synthetic',mobile:customers[1].mobile,age:35,occupation:'Test',address:'Isolated',city:'North',area:'Test',status:'APPROVED',approvedAt:new Date()});
 await Customer.updateOne({_id:customers[1]._id},{$set:{kycLeadId:lead._id,kycApprovedAt:new Date()}});
 await Promise.all([Customer,Employee,Loan,Schedule,Collection,Audit,require('../../src/models/CustomerTimeline')].map(m=>m.init()));
 beforeFinancial=await fingerprint();
});
afterAll(async()=>{
 const fs=require('fs'),path=require('path'),dir=path.resolve(__dirname,'../../../tmp/financial-audit');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'portfolio-performance.json'),JSON.stringify({isolated:true,customers:1000,queryPlanMetrics,requests:perf},null,2));
 await mongoose.disconnect();await repl?.stop();
});

test('directory exposes private photo availability metadata only for the matching employee',async()=>{
 const Settings=require('../../src/models/AccountSettings');
 await Settings.create({userId:employees[0]._id,role:'EMPLOYEE',photoType:'image/png',photo:Buffer.from('PRIVATE-PHOTO-SENTINEL'),photoUpdatedAt:new Date('2026-01-01')});
 const body=await read('/?sort=name');
 expect(body.rows.find(r=>String(r._id)===String(employees[0]._id)).hasPhoto).toBe('2026-01-01T00:00:00.000Z');
 expect(body.rows.find(r=>String(r._id)===String(employees[1]._id)).hasPhoto).toBe(false);
 expect(JSON.stringify(body)).not.toContain('PRIVATE-PHOTO-SENTINEL');
 expect(body.rows[0]).not.toHaveProperty('photo');
 const forbidden=await call('get','/customer-portfolios',employeeToken);expect(forbidden.status).toBe(403);
});

test('directory totals count distinct customers, including an employee with zero customers',async()=>{
 const body=await read('/?sort=name');expect(body.summary).toEqual({totalEmployees:4,activeEmployees:3,inactiveEmployees:1,totalOutstanding:39900,totalCustomers:1000,assignedCustomers:990,unassignedCustomers:10,activeCustomers:900,customersWithActiveLoans:2});
 expect(body.rows[0]).toMatchObject({name:'Alpha Employee',customerCount:650,activeLoanCustomers:2,activeLoanCount:2,overdueCustomers:1,totalOutstanding:39900});
 expect(body.rows.find(r=>r.name==='Empty Employee')).toMatchObject({customerCount:0,activeLoanCustomers:0,activeLoanCount:0,overdueCustomers:0,totalOutstanding:0});
 expect(JSON.stringify(body)).not.toContain('password');
});
test('directory search, branch/status filters, aggregate sorting and bounded pagination',async()=>{
 expect((await read('/?search=alpha')).meta.total).toBe(1);expect((await read('/?search=9100000101')).rows[0]._id).toBe(String(employees[1]._id));
 expect((await read(`/?branchId=${branches[0]._id}&status=ACTIVE`)).meta.total).toBe(2);
 expect((await read('/?sort=customerCount&direction=desc&limit=1')).rows[0].customerCount).toBe(650);
 expect((await read('/?sort=outstandingMinor&direction=desc')).rows[0].totalOutstanding).toBe(39900);
 expect((await read('/?search=%5E.*')).meta.total).toBe(0);
 for(const query of ['limit=101','page=0','sort=password','status=ADMIN','branchId=bad','direction=other'])expect((await call('get','/customer-portfolios/?'+query)).status).toBe(422);
});
test('hundreds of assigned customers use stable server pages and thin projections',async()=>{
 const url='/employees/'+employees[0]._id;
 const first=await read(url+'?limit=50'),second=await read(url+'?limit=50&page=2');expect(first.meta).toMatchObject({total:650,totalPages:13,limit:50});expect(first.rows).toHaveLength(50);expect(new Set([...first.rows,...second.rows].map(r=>r._id)).size).toBe(100);
 expect(JSON.stringify(first)).not.toContain('PRIVATE-IDENTITY-SENTINEL');expect(first.rows[0].address).toBeUndefined();
 expect((await read(url+'?search=9200000001')).rows[0]._id).toBe(String(customers[1]._id));
 expect((await read(url+'?status=INACTIVE')).meta.total).toBe(65);
 expect((await read('/employees/'+employees[2]._id)).meta.total).toBe(0);
 const legacy=await call('get','/customers');expect(legacy.status).toBe(200);expect(JSON.stringify(legacy.body)).not.toContain('PRIVATE-IDENTITY-SENTINEL');
});
test('unassigned customers include missing and dangling owners without fabricating relationships',async()=>{
 const body=await read('/customers?assignment=unassigned');expect(body.meta.total).toBe(10);expect(body.rows.every(r=>!r.employee)).toBe(true);
 expect((await read('/customers?assignment=all')).meta.total).toBe(1000);
});
test('multiple loans, overdue after maturity and advances use authoritative amounts',async()=>{
 const result=await read('/customers?loanState=active&sort=outstandingMinor&direction=desc');expect(result.meta.total).toBe(2);expect(result.rows[0]).toMatchObject({loanCount:2,activeLoanCount:1,totalOutstanding:21000,overdueAmount:21000,overdueInstallments:30,kycStatus:'APPROVED'});
 expect((await read('/customers?loanState=overdue')).meta.total).toBe(1);expect((await read('/customers?loanState=none')).meta.total).toBe(998);
 expect((await read('/customers?kycStatus=APPROVED')).meta.total).toBe(1);
 const upcoming=await read(`/customers/${customers[2]._id}/installments?scope=UPCOMING&limit=2`);expect(upcoming.meta.total).toBe(30);expect(upcoming.rows.every(r=>r.displayStatus==='PAID_EARLY'&&!r.canCollect)).toBe(true);
 const loans=await read(`/customers/${customers[1]._id}/loans?limit=1`);expect(loans.meta.total).toBe(2);expect(loans.rows).toHaveLength(1);
 const overdue=await read(`/customers/${customers[1]._id}/installments?scope=OVERDUE&limit=100`);expect(overdue.rows).toHaveLength(30);
 const payments=await read(`/customers/${customers[2]._id}/payments`);expect(payments.meta.total).toBe(1);expect(payments.rows[0].allocations).toHaveLength(3);expect(payments.rows[0].allocations.every(a=>a.timing==='PAID_EARLY')).toBe(true);expect(payments.rows[0].createdAt).toBeTruthy();
});
test('customer detail summarizes recorded receipts separately from saved paid balances and finds the next unpaid due',async()=>{
 const received=await read('/customers/'+customers[2]._id);expect(received.data).toMatchObject({totalCollected:2100,recordedReceiptCount:1,nextInstallment:{dayNumber:4,remainingAmount:700}});
 const completedWithoutReceipts=await read('/customers/'+customers[1]._id);expect(completedWithoutReceipts.data.totalCollected).toBe(0);expect(completedWithoutReceipts.data.closedLoanCount).toBe(1);expect(completedWithoutReceipts.data.nextInstallment.dayNumber).toBe(1);
 const empty=await read('/customers/'+customers[0]._id);expect(empty.data).toMatchObject({totalCollected:0,recordedReceiptCount:0,nextInstallment:null});
 expect(received.data).not.toHaveProperty('idProofNumber');
});
test('paid/advance directory filters paginate before rendering and preserve exact-installment payment history',async()=>{
 const base=`/customers/${customers[2]._id}/installments`;
 const paid=await read(base+'?scope=PAID&limit=1');expect(paid.meta).toMatchObject({total:3,totalPages:3});expect(paid.rows).toHaveLength(1);expect(paid.rows[0].hasPaymentHistory).toBe(true);expect(paid.remainingAmount).toBe(0);
 const advance=await read(base+'?scope=ADVANCE');expect(advance.meta.total).toBe(3);expect(advance.rows.every(row=>row.displayStatus==='PAID_EARLY'&&row.hasPaymentHistory)).toBe(true);
 const all=await read(base+'?scope=ALL&limit=5');expect(all.rows[3]).toMatchObject({dayNumber:4,paidAmount:0,hasPaymentHistory:false,paymentAllocationCount:0});expect(all.rows[0].receiptSummaries[0].allocatedAmount).toBe(700);
 expect((await read(`/customers/${customers[1]._id}/installments?scope=ADVANCE`)).meta.total).toBe(0);
});

test('Admin-only APIs reject Employee reads/writes, anonymous requests and malformed identifiers',async()=>{
 for(const path of ['','/employees/options','/employees/'+employees[0]._id,'/customers','/customers/'+customers[0]._id,...['loans','payments','history','installments'].map(section=>`/customers/${customers[0]._id}/${section}`)])expect((await call('get','/customer-portfolios'+path,employeeToken)).status).toBe(403);
 expect((await request(app).get('/api/v1/customer-portfolios')).status).toBe(401);
 expect((await call('patch',`/customer-portfolios/customers/${customers[1]._id}/assignment`,employeeToken).send({})).status).toBe(403);
 expect((await call('get','/customer-portfolios/customers/bad')).status).toBe(422);
 expect((await call('get','/customer-portfolios/customers/'+new mongoose.Types.ObjectId())).status).toBe(404);
 expect((await call('get',`/customer-portfolios/customers/${customers[1]._id}/installments?scope=INVALID`)).status).toBe(422);
});
test('reassignment validates reason, current assignment and active destination before writing',async()=>{
 const url=`/customer-portfolios/customers/${customers[1]._id}/assignment`,body={previousEmployeeId:String(employees[0]._id),employeeId:String(employees[1]._id),reason:'Synthetic portfolio reassignment'};
 for(const extra of [{reason:' '},{employeeId:'bad'},{employeeId:String(employees[3]._id)},{employeeId:String(new mongoose.Types.ObjectId())}])expect((await call('patch',url).send({...body,...extra})).status).toBe(422);
 expect((await call('patch',url).send({...body,previousEmployeeId:null})).status).toBe(409);
 expect((await call('patch',url).send({...body,employeeId:String(employees[0]._id)})).status).toBe(409);
 expect((await Customer.findById(customers[1]._id)).employeeId).toEqual(employees[0]._id);
});
test('audited reassignment changes profile/KYC authorization and preserves all historical finances',async()=>{
 const customerId=String(customers[1]._id),url=`/customer-portfolios/customers/${customerId}/assignment`,body={previousEmployeeId:String(employees[0]._id),employeeId:String(employees[1]._id),reason:'Synthetic portfolio reassignment'};
 expect((await call('get','/customers/'+customerId,employeeToken)).status).toBe(200);
 const r=await call('patch',url).send(body);expect(r.status).toBe(200);expect(r.body.data.effectiveAt).toBeTruthy();
 expect((await call('patch',url).send(body)).status).toBe(409);
 const detail=await read('/customers/'+customerId);expect(detail.data.employee._id).toBe(String(employees[1]._id));expect(detail.data.kycStatus).toBe('APPROVED');
 expect((await Lead.findById(lead._id)).assignedEmployeeId).toEqual(employees[1]._id);
 expect((await call('get','/customers/'+customerId,employeeToken)).status).toBe(404);expect((await call('get','/customers/'+customerId,otherToken)).status).toBe(200);
 expect((await call('get','/customer-leads/'+lead._id,employeeToken)).status).toBe(404);expect((await call('get','/customer-leads/'+lead._id,otherToken)).status).toBe(200);
 const audit=await Audit.findOne({action:'CUSTOMER_REASSIGNED',referenceId:customerId});expect(audit.oldValue.employeeId).toBe(String(employees[0]._id));expect(audit.newValue.reason).toBe(body.reason);expect(audit.newValue.effectiveAt).toBeInstanceOf(Date);
 const history=await read('/customers/'+customerId+'/history');expect(history.rows.some(r=>r.action==='CUSTOMER_REASSIGNED')).toBe(true);expect(JSON.stringify(history)).not.toContain('oldValue');
 const loan=await Loan.findById(oldLoan._id);expect(loan.employeeId).toEqual(employees[0]._id);expect(loan.createdBy).toEqual(employees[0]._id);expect(await fingerprint()).toEqual(beforeFinancial);
});
test('indexed prefix search and name order avoid customer collection scans',async()=>{
 const plan=await Customer.find({employeeId:employees[0]._id}).collation({locale:'en',strength:2}).sort({name:1,_id:1}).limit(20).explain('executionStats');
 expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('portfolio_owner_name');expect(plan.executionStats.totalDocsExamined).toBeLessThanOrEqual(20);
 queryPlanMetrics={index:'portfolio_owner_name',documentsExamined:plan.executionStats.totalDocsExamined,keysExamined:plan.executionStats.totalKeysExamined,returned:plan.executionStats.nReturned,executionMilliseconds:plan.executionStats.executionTimeMillis};
 expect(await fingerprint()).toEqual(beforeFinancial);
});
test('Admin assigns legacy unassigned and dangling-owner customers without touching their location or finances',async()=>{
 for(const index of [990,999]){
  const original=await Customer.findById(customers[index]._id).lean();
  const response=await call('patch',`/customer-portfolios/customers/${original._id}/assignment`).send({previousEmployeeId:original.employeeId?String(original.employeeId):null,employeeId:String(employees[2]._id),reason:'Resolve synthetic legacy unassigned customer'});
  expect(response.status).toBe(200);const updated=await Customer.findById(original._id).lean();expect(updated.employeeId).toEqual(employees[2]._id);expect(updated.city).toBe(original.city);expect(updated.area).toBe(original.area);expect(updated.address).toBe(original.address);
 }
 expect((await read('/customers?assignment=unassigned')).meta.total).toBe(8);expect((await read('/employees/'+employees[2]._id)).meta.total).toBe(2);
 expect(await fingerprint()).toEqual(beforeFinancial);
});
test('inactive Admin accounts cannot read or reassign portfolios',async()=>{
 await Admin.updateOne({_id:admin._id},{$set:{isActive:false}});
 try{expect((await call('get','/customer-portfolios')).status).toBe(403);expect((await call('patch',`/customer-portfolios/customers/${customers[1]._id}/assignment`).send({})).status).toBe(403);}
 finally{await Admin.updateOne({_id:admin._id},{$set:{isActive:true}});}
});


test('an early partial allocation stays in the advance view after a later receipt completes the installment',async()=>{
 const issue=addDays(businessDay(),-5),loan=await createLoanService({customerId:String(customers[3]._id),loanAmount:2000,interestPercent:5,durationDays:3,loanDate:issue},{id:String(employees[0]._id),role:'EMPLOYEE'});
 const first=await Schedule.findOne({loanId:loan._id}).sort({dayNumber:1});
 for(const [amount,received]of [[100,issue],[600,addDays(issue,1)]]){
  const response=await call('post','/collections',employeeToken).send({loanScheduleId:String(first._id),amountReceived:amount,paymentMode:'CASH',paymentDate:received,backdateReason:'Isolated advance filter regression',financeVersion:2,idempotencyKey:crypto.randomBytes(16).toString('hex')});expect(response.status).toBe(201);
 }
 const result=await read(`/customers/${customers[3]._id}/installments?scope=ADVANCE`);
 expect(result.meta.total).toBe(1);expect(result.rows[0]).toMatchObject({dayNumber:1,paidAmount:700,remainingAmount:0,displayStatus:'PAID_ON_TIME',hasPaymentHistory:true});
 expect(result.rows[0].receiptSummaries).toHaveLength(2);expect(result.rows[0].receiptSummaries.some(row=>row.allocationTiming==='PAID_EARLY')).toBe(true);
});
