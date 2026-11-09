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


const performance=require('../../src/services/collectionPerformance.service');
test('employee target is schedule-based, partial remaining is accurate, and reads preserve the existing 700 receipt',async()=>{
 const loan=await issue(1),rows=await schedules(loan);const p=ok(await pay(rows[0],700),201),original=JSON.stringify(await Collection.findById(p._id).lean());const today=businessDay();
 const data=ok(await call('get','/dashboard/collection-performance?date='+today));expect(data.target).toBe(700);expect(data.covered).toBe(700);expect(data.remaining).toBe(0);expect(data.collected).toBe(700);
 const old=ok(await call('get','/dashboard/collection-performance?date='+addDays(today,-1)));expect(old.collected).toBe(0);expect(JSON.stringify(await Collection.findById(p._id).lean())).toBe(original);
 const tracking=ok(await call('get','/collections/tracking?date='+today));expect(tracking.rows.find(r=>String(r._id)===String(p._id))).toMatchObject({paymentState:'RECORDED',amountReceived:700});
});
test('employees cannot query another employee, Admin can filter, invalid dates and paging are rejected',async()=>{
 expect((await call('get','/dashboard/collection-performance?employeeId='+other._id)).status).toBe(403);expect((await call('get','/collections/tracking?employeeId='+other._id)).status).toBe(403);
 expect((await call('get','/dashboard/collection-performance?date=2026-02-30')).status).toBe(422);expect((await call('get','/collections/tracking?limit=10000')).status).toBe(422);
 const data=ok(await call('get','/dashboard/collection-performance?employeeId='+other._id,adminToken));expect(data.rows).toEqual([]);expect(data.collected).toBe(0);
});
test('review remarks persist with audit history and review never changes partial financial balances',async()=>{
 const loan=await issue(0),row=(await schedules(loan))[0],payment=ok(await pay(row,200),201),before=JSON.stringify(await Loan.findById(loan._id).lean());
 ok(await call('post','/collections/receipt/'+payment._id+'/verify',adminToken).send({remarks:'Checked synthetic receipt against field records.'}));
 const tracking=ok(await call('get','/collections/tracking',adminToken)),found=tracking.rows.find(r=>String(r._id)===String(payment._id));expect(found.paymentState).toBe('VERIFIED');expect(found.status).toBe('PARTIAL');expect(found.review.remarks).toBe('Checked synthetic receipt against field records.');expect(JSON.stringify(await Loan.findById(loan._id).lean())).toBe(before);
 expect((await call('post','/collections/receipt/'+payment._id+'/verify',adminToken).send({remarks:'x'.repeat(1001)})).status).toBe(422);
});
test('an advance receipt is listed once and paginated receipt metadata is correct',async()=>{
 const loan=await issue(0),row=(await schedules(loan))[0],payment=ok(await pay(row,2100),201);const data=ok(await call('get','/collections/tracking?limit=1&page=1'));expect(data.rows).toHaveLength(1);expect(data.meta.total).toBeGreaterThan(1);const all=ok(await call('get','/collections/tracking?limit=100'));expect(all.rows.filter(r=>String(r._id)===String(payment._id))).toHaveLength(1);expect((await performance.report(actor(),{date:businessDay()})).collectionPercent).toBeLessThanOrEqual(100);
});

test('employee workspace shows actual 800 receipts, 700/100 allocations, live sequence and read-only history',async()=>{
 const loan=await issue(1),rows=await schedules(loan),today=businessDay();
 const receipt=ok(await pay(rows[0],800),201),before=JSON.stringify(await Collection.findById(receipt._id).lean());
 const data=ok(await call('get','/dashboard/employee-workspace?date='+today+'&loanId='+loan._id+'&limit=100'));
 expect(data.timeline[0]).toMatchObject({paidAmount:700,remaining:0,hasPaymentHistory:true,currentSchedule:{canCollect:false}});
 expect(data.timeline[1]).toMatchObject({paidAmount:100,remaining:600,hasPaymentHistory:true,currentSchedule:{canCollect:true}});
 expect(data.timeline[2]).toMatchObject({paidAmount:0,remaining:700,hasPaymentHistory:false,currentSchedule:{canCollect:false,collectionLocked:true}});
 expect(data.timeline).toHaveLength(30);expect(data.trend).toHaveLength(7);expect(data.trend.at(-1)).toMatchObject({date:today,amount:data.collected});
 const beforeDate=ok(await call('get','/dashboard/employee-workspace?date='+addDays(today,-1)+'&loanId='+loan._id));
 expect(beforeDate.collected).toBe(0);expect(beforeDate.timeline[0].remaining).toBe(700);expect(beforeDate.timeline[0].currentSchedule.canCollect).toBe(false);
 expect(JSON.stringify(await Collection.findById(receipt._id).lean())).toBe(before);
 const byMobile=ok(await call('get','/dashboard/employee-workspace?search='+encodeURIComponent((await Customer.findById(loan.customerId)).mobile)+'&limit=100'));
 expect(byMobile.rows).toHaveLength(30);expect(byMobile.rows.every(r=>String(r.loanId)===String(loan._id))).toBe(true);expect(byMobile.rows[0].mobile).toBeUndefined();
 const paid=ok(await call('get','/dashboard/employee-workspace?filter=PAID&limit=100'));expect(paid.rows.every(r=>r.remaining===0)).toBe(true);
 const p=ok(await call('get','/dashboard/employee-workspace?limit=1&page=2'));expect(p.rows).toHaveLength(1);expect(p.meta.page).toBe(2);
});

test('workspace blocks foreign loans, unauthorized roles and invalid filters without leaking records',async()=>{
 const loan=await issue(1);
 expect((await call('get','/dashboard/employee-workspace?loanId='+loan._id,otherToken)).status).toBe(404);
 expect((await call('get','/dashboard/employee-workspace?employeeId='+employee._id,otherToken)).status).toBe(403);
 expect((await call('get','/dashboard/employee-workspace',adminToken)).status).toBe(403);
 expect((await request(app).get('/api/v1/dashboard/employee-workspace')).status).toBe(401);
 for(const query of ['date=2026-02-30','loanId=invalid','filter=unknown','limit=1000','search='+('x'.repeat(101))])expect((await call('get','/dashboard/employee-workspace?'+query)).status).toBe(422);
 const empty=ok(await call('get','/dashboard/employee-workspace',otherToken));expect(empty.rows).toEqual([]);expect(empty.loans).toEqual([]);expect(empty.collected).toBe(0);expect(empty.trend.every(r=>r.amount===0)).toBe(true);
});
