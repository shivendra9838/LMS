const request=require('supertest'),mongoose=require('mongoose'),{MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection');
const {generateToken}=require('../../src/utils/jwt'),{businessDay,addDays}=require('../../src/utils/businessDay');
let repl,admin,a,b,token,adminToken,customers,foreign,loan;
jest.setTimeout(180000);
const get=(path,auth=token)=>request(app).get('/api/v1'+path).set('Authorization','Bearer '+auth);
const ok=res=>{expect({status:res.status,body:res.body}).toMatchObject({status:200});return res.body.data;};
const snapshot=async()=>JSON.stringify(await Promise.all([Customer,Loan,Schedule,Collection,require('../../src/models/CustomerRiskAssessment'),require('../../src/models/AuditLog')].map(model=>model.find().sort({_id:1}).lean())));
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-customer-portfolio';process.env.KYC_ENCRYPTION_KEY='75'.repeat(32);
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'employee_customer_portfolio_isolated'});
 admin=await Admin.create({name:'Synthetic Admin',email:'portfolio-admin@example.test',password:'Isolated123!',phone:'9900000000'});
 const employee=(code,n)=>Employee.create({name:'Synthetic '+code,employeeCode:code,email:code+'@example.test',password:'Isolated123!',phone:'99000000'+n,city:'Test',area:'Test',createdBy:admin._id});a=await employee('ECP-A','01');b=await employee('ECP-B','02');
 token=generateToken(a._id,'EMPLOYEE');adminToken=generateToken(admin._id,'ADMIN');
 const customer=(owner,i)=>({name:i===0?'Alpha Synthetic':i===2?' =HYPERLINK("synthetic")':'Synthetic customer '+i,customerCode:'CUS-PC-'+String(i).padStart(3,'0'),mobile:String(9900001000+i),employeeId:owner._id,createdBy:admin._id,fatherName:'Synthetic',age:35,occupation:'Test business',address:'Synthetic address only',city:i%2?'Jaunpur':'Varanasi',area:i%2?'Test North':'Test South',status:i===1?'INACTIVE':'ACTIVE',idProofNumber:'SYNTHETIC-PRIVATE-IDENTITY'});
 customers=await Customer.insertMany(Array.from({length:12},(_,i)=>customer(a,i)));foreign=await Customer.create({...customer(b,99),name:'Foreign synthetic customer'});
 loan=await require('../../src/services/loan.service').createLoanService({customerId:String(customers[0]._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(businessDay(),-3)},{id:String(a._id),role:'EMPLOYEE'});
 const schedule=await Schedule.findOne({loanId:loan._id}).sort({dayNumber:1});await require('../../src/services/collection.service').recordCollectionService({loanScheduleId:String(schedule._id),amountReceived:800,paymentDate:businessDay(loan.loanDate),backdateReason:'Synthetic issue-date advance',paymentMode:'CASH',financeVersion:2,idempotencyKey:'isolated-customer-portfolio-payment'},{id:String(a._id),role:'EMPLOYEE'});
});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});
test('portfolio counts, paginated rows, real risk and loan summary are read-only and employee scoped',async()=>{
 const before=await snapshot(),data=ok(await get('/customers/portfolio?limit=10'));
 expect(data.summary).toMatchObject({ALL:12,ACTIVE:11,INACTIVE:1});expect(data.rows).toHaveLength(10);expect(data.meta).toMatchObject({total:12,totalPages:2,page:1});
 const all=ok(await get('/customers/portfolio?limit=100&sort=OVERDUE'));expect(all.rows[0]).toMatchObject({_id:String(customers[0]._id),overdueAmount:600,activeLoanCount:1,outstandingAmount:20200});
 const assessment=ok(await get('/customer-risk/batch?ids='+customers.map(c=>c._id).join(',')));expect(all.summary.AT_RISK).toBe(assessment.filter(r=>r.category!=='GOOD').length);
 expect(all.rows.find(r=>r._id===String(customers[0]._id)).risk.category).toBe(assessment.find(r=>r.customerId===String(customers[0]._id)).category);
 expect(JSON.stringify(data)).not.toMatch(/SYNTHETIC-PRIVATE|Foreign synthetic|idProofNumber|password/);expect(await snapshot()).toBe(before);
});
test('literal search, location, status/risk filters, sorting and pages compose consistently',async()=>{
 const inactive=ok(await get('/customers/portfolio?filter=INACTIVE&city=Jaunpur'));expect(inactive.rows.map(r=>r._id)).toEqual([String(customers[1]._id)]);
 const mobile=ok(await get('/customers/portfolio?search='+customers[0].mobile));expect(mobile.meta.total).toBe(1);
 expect(ok(await get('/customers/portfolio?search=.*')).meta.total).toBe(0);
 const names=ok(await get('/customers/portfolio?sort=NAME_ASC&limit=100')).rows.map(r=>r.name);expect(names).toEqual([...names].sort((a,b)=>a.localeCompare(b,'en',{sensitivity:'base',numeric:true})));
 const desc=ok(await get('/customers/portfolio?sort=NAME_DESC&limit=100')).rows.map(r=>r.name);expect(desc).toEqual([...names].reverse());
 const code=ok(await get('/customers/portfolio?sort=CODE&limit=5&page=2'));expect(code.rows[0].customerCode).toBe('CUS-PC-005');
 const insufficient=ok(await get('/customers/portfolio?category=INSUFFICIENT_HISTORY&filter=AT_RISK&limit=100'));expect(insufficient.rows.every(r=>r.risk.category==='INSUFFICIENT_HISTORY')).toBe(true);
 const first=ok(await get('/customers/portfolio?sort=CODE&limit=10')),second=ok(await get('/customers/portfolio?sort=CODE&limit=10&page=2'));expect(second.rows).toHaveLength(2);expect(first.rows.some(a=>second.rows.some(b=>a._id===b._id))).toBe(false);
});
test('CSV exports all current filtered results, protects formula cells and omits private and foreign data',async()=>{
 const before=await snapshot(),response=await get('/customers/portfolio/export?filter=ACTIVE&city=Varanasi');expect(response.status).toBe(200);expect(response.headers['content-type']).toContain('text/csv');expect(response.headers['content-disposition']).toContain('attachment');
 expect(response.text).toContain("' =HYPERLINK");expect(response.text).toContain('20200');expect(response.text).not.toMatch(/Foreign synthetic|Jaunpur|SYNTHETIC-PRIVATE|idProofNumber/);
 const all=await get('/customers/portfolio/export');expect(all.text.trim().split('\r\n')).toHaveLength(13);expect(await snapshot()).toBe(before);
});
test('authentication, roles, invalid inputs and cross-employee list/export requests remain protected',async()=>{
 expect((await request(app).get('/api/v1/customers/portfolio')).status).toBe(401);expect((await get('/customers/portfolio',adminToken)).status).toBe(403);
 for(const endpoint of ['/customers/portfolio','/customers/portfolio/export'])expect((await get(endpoint+'?employeeId='+b._id)).status).toBe(403);
 for(const query of ['filter=INVALID','sort=password','category=INVALID','page=0','limit=1000','search='+'x'.repeat(101)])expect((await get('/customers/portfolio?'+query)).status).toBe(422);
 expect((await get('/customers/'+foreign._id)).status).toBe(404);
 const foreignEdit=await request(app).patch('/api/v1/customers/'+foreign._id+'/status').set('Authorization','Bearer '+token).send({status:'INACTIVE'});expect(foreignEdit.status).toBe(404);
 const ownLoans=ok(await get('/loans?customer='+customers[0]._id));expect(ownLoans).toHaveLength(1);expect(ok(await get('/loans?customer='+foreign._id))).toEqual([]);
 expect((await get('/customers',adminToken)).status).toBe(200);
});
