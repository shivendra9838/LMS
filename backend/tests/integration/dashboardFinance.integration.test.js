const request=require('supertest'),mongoose=require('mongoose'),{MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
const app=require('../../src/app'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Customer=require('../../src/models/Customer'),Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Collection=require('../../src/models/Collection');
const {businessDay,addDays}=require('../../src/utils/businessDay'),{generateToken}=require('../../src/utils/jwt');
let repl,admin,a,b,token,otherToken,adminToken,today,customers,loans,rows,firstReceipt;const key=()=>require('crypto').randomBytes(16).toString('hex');
jest.setTimeout(180000);
const get=(url,auth=token)=>request(app).get('/api/v1'+url).set('Authorization','Bearer '+auth);
const ok=(r,status=200)=>{expect({status:r.status,body:r.body}).toMatchObject({status});return r.body.data;};
const dashboard=(query='')=>get('/dashboard/employee-workspace?limit=100&'+query);
const pay=(row,amount,extra={})=>request(app).post('/api/v1/collections').set('Authorization','Bearer '+token).send({loanScheduleId:String(row._id),amountReceived:amount,paymentMode:'CASH',financeVersion:2,idempotencyKey:key(),...extra});
// Isolated pre-minimum-rule history fixture. This is not a new API payment.
async function historicalPartial(row,amount,date){
 const loan=await Loan.findById(row.loanId),current=await Schedule.findById(row._id);
 const receipt=await Collection.create({collectionNumber:'LEGACY-PARTIAL-'+key(),loanId:loan._id,loanScheduleId:row._id,customerId:loan.customerId,employeeId:a._id,collectedBy:a._id,recordedByRole:'EMPLOYEE',amountReceived:amount,expectedAmount:current.amount-current.paidAmount,paymentMode:'CASH',status:'PARTIAL',paymentDate:date,allocations:[{scheduleId:row._id,dueDate:row.date,amount}]});
 current.paidAmount+=amount;current.paidDate=date;current.status='PARTIAL';await current.save();loan.paidAmount+=amount;loan.remainingAmount-=amount;loan.lastPaymentDate=date;await loan.save();return receipt;
}
const financial=async()=>JSON.stringify(await Promise.all([Loan,Schedule,Collection,require('../../src/models/CollectionPosition'),require('../../src/models/EmployeeSettlement')].map(m=>m.find().sort({_id:1}).lean())));
beforeAll(async()=>{
 process.env.JWT_SECRET='isolated-dashboard-finance';process.env.KYC_ENCRYPTION_KEY='75'.repeat(32);today=businessDay();
 repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'dashboard_finance_isolated'});
 admin=await Admin.create({name:'Synthetic Admin',email:'finance-dashboard-admin@example.test',password:'Isolated123!',phone:'9800000000'});
 const employee=(code,n)=>Employee.create({name:'Synthetic '+code,employeeCode:code,email:code+'@example.test',password:'Isolated123!',phone:'98000000'+n,city:'Test',area:'Test',createdBy:admin._id});a=await employee('DASH-A','01');b=await employee('DASH-B','02');
 token=generateToken(a._id,'EMPLOYEE');otherToken=generateToken(b._id,'EMPLOYEE');adminToken=generateToken(admin._id,'ADMIN');customers=[];loans=[];rows=[];
 for(let i=0;i<3;i++){const c=await Customer.create({name:'Synthetic dashboard '+i,customerCode:'DASH-C-'+i,employeeId:a._id,createdBy:admin._id,fatherName:'Synthetic',mobile:String(9800010000+i),age:35,occupation:'Test',address:'Synthetic only',city:'Test',area:'Test'});customers.push(c);const loan=await require('../../src/services/loan.service').createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(today,i===1?-3:-1)},{id:String(a._id),role:'EMPLOYEE'});loans.push(loan);rows.push(await Schedule.find({loanId:loan._id}).sort({dayNumber:1}));}
 firstReceipt=ok(await pay(rows[0][0],800),201);await historicalPartial(rows[1][0],300,addDays(today,-1));
});
afterAll(async()=>{await mongoose.disconnect();await repl?.stop();});
test('all assigned customer targets, full receipts, advances and chart reconcile without duplicate cash',async()=>{
 const before=await financial(),data=ok(await dashboard('loanId='+loans[0]._id));
 expect(data).toMatchObject({openingCollectible:3200,remainingCollectible:2500,collectibleAllocatedOnDate:700,target:2100,collected:800,covered:700,remaining:1400,dueCount:3,dueCustomerCount:3,activeCustomers:3,assignedCustomers:3,advanceAllocatedOnDate:100});
 expect(data.trend.at(-1)).toMatchObject({date:today,amount:800});expect(data.trend.at(-2).amount).toBe(300);
 expect(data.rows.reduce((n,r)=>n+r.actualReceived,0)).toBe(800);expect(data.timeline[0]).toMatchObject({actualReceived:800,paidAmount:700,remaining:0});expect(data.timeline[1]).toMatchObject({actualReceived:0,paidAmount:100,remaining:600,advanceApplied:100});
 expect(data.timeline[0].receiptSummaries[0]).toMatchObject({amount:800,allocatedAmount:700,advanceCarriedForward:100,unallocatedAmount:0,review:null});
 expect(data.timeline[1].receiptSummaries[0]).toMatchObject({amount:800,allocatedAmount:100,primary:false});
 const selected=ok(await dashboard('loanId='+loans[1]._id));expect(selected.target).toBe(2100);expect(selected.selectedLoan).toBe(String(loans[1]._id));
 const search=ok(await dashboard('search='+customers[1].mobile));expect(search.meta.total).toBe(30);expect(search.counts.ALL).toBe(30);expect(search.target).toBe(2100);expect(await financial()).toBe(before);
});
test('partial overdue payment increases actual cash but does not falsely cover today’s scheduled installment',async()=>{
 await historicalPartial(rows[1][0],100,new Date());const data=ok(await dashboard());expect(data).toMatchObject({openingCollectible:3200,remainingCollectible:2400,collectibleAllocatedOnDate:800,target:2100,collected:900,remaining:1400});
 const row=data.rows.find(r=>r._id===String(rows[1][0]._id));expect(row).toMatchObject({amount:700,paidAmount:400,remaining:300,allocatedOnDate:100,status:'PARTIALLY_PAID'});
});
test('900 follows earliest-unpaid sequence and receipt review is not a second payment or settlement',async()=>{
 const receipt=ok(await pay(rows[0][1],900),201);expect(receipt.allocations.map(a=>a.amount)).toEqual([600,300]);
 const data=ok(await dashboard('loanId='+loans[0]._id));expect(data).toMatchObject({target:2100,collected:1800,remaining:1400});expect(data.rows.reduce((n,r)=>n+r.actualReceived,0)).toBe(1800);expect(data.timeline[1].remaining).toBe(0);expect(data.timeline[2].remaining).toBe(400);
 const before=await financial();ok(await request(app).post('/api/v1/collections/receipt/'+firstReceipt._id+'/verify').set('Authorization','Bearer '+adminToken).send({remarks:'Synthetic dashboard review'}));
 const reviewed=ok(await dashboard('loanId='+loans[0]._id));expect(reviewed.collected).toBe(1800);expect(reviewed.timeline[0].receiptSummaries[0].review.verifiedBy).toBe('Synthetic Admin');expect(await financial()).toBe(before);expect(await require('../../src/models/EmployeeSettlement').countDocuments()).toBe(0);
 const report=ok(await get('/dashboard/collection-performance',adminToken));expect(report).toMatchObject({target:2100,collected:1800,remaining:1400});
});
test('received date differs from entry date and prior advances reduce tomorrow without new cash',async()=>{
 const yesterday=ok(await dashboard('date='+addDays(today,-1)));expect(yesterday.collected).toBe(300);expect(yesterday.trend.at(-1).amount).toBe(300);
 const next=ok(await dashboard('date='+addDays(today,1)));expect(next).toMatchObject({target:2100,collected:0,coveredBeforeDate:700,remaining:1400});expect(next.trend.at(-1).amount).toBe(0);
});
test('same-day full payoff preserves the opening target, while later completed-loan targets disappear',async()=>{
 ok(await pay(rows[2][0],21000),201);expect((await Loan.findById(loans[2]._id)).status).toBe('COMPLETED');
 const todayData=ok(await dashboard());expect(todayData.target).toBe(2100);expect(todayData.collected).toBe(22800);expect(todayData.remaining).toBe(700);
 const next=ok(await dashboard('date='+addDays(today,1)));expect(next).toMatchObject({target:1400,collected:0,remaining:700});
 const admin=ok(await get('/dashboard/collection-performance?date='+addDays(today,1),adminToken));expect(admin.target).toBe(1400);
});
test('invalid historical receipt states are excluded and stale coverage is flagged without repair',async()=>{
 const c=await Customer.create({name:'Synthetic legacy invalidation',customerCode:'DASH-VOID',employeeId:a._id,createdBy:admin._id,fatherName:'Synthetic',mobile:'9800010099',age:35,occupation:'Test',address:'Test',city:'Test',area:'Test'}),loan=await require('../../src/services/loan.service').createLoanService({customerId:String(c._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(today,-1)},{id:String(a._id),role:'EMPLOYEE'}),row=await Schedule.findOne({loanId:loan._id}).sort({dayNumber:1});
 // Native insert models a legacy imported state; the application schema/API is not weakened.
 await Collection.collection.insertOne({_id:new mongoose.Types.ObjectId(),collectionNumber:'SYN-VOID',loanId:loan._id,loanScheduleId:row._id,customerId:c._id,employeeId:a._id,collectedBy:a._id,recordedByRole:'EMPLOYEE',amountReceived:700,paymentDate:new Date(),createdAt:new Date(),status:'VOIDED',allocations:[{scheduleId:row._id,dueDate:row.date,amount:700}]});await Schedule.updateOne({_id:row._id},{$set:{paidAmount:700,paidDate:new Date()}});
 const before=await financial(),data=ok(await dashboard('loanId='+loan._id));expect(data.collected).toBe(22800);expect(data.timeline[0]).toMatchObject({paidAmount:0,remaining:700,requiresHistoryReview:true,currentSchedule:{canCollect:false}});expect(data.timeline[0].receiptSummaries).toEqual([]);expect(data.reconciliationIssues).toBeGreaterThan(0);expect(await financial()).toBe(before);
 expect(ok(await get('/collections/tracking?limit=100')).rows.some(r=>r.collectionNumber==='SYN-VOID')).toBe(false);
});
test('other employees cannot query the portfolio or loan, and empty portfolios do not invent customers',async()=>{
 expect((await get('/dashboard/employee-workspace?employeeId='+a._id,otherToken)).status).toBe(403);expect((await get('/dashboard/employee-workspace?loanId='+loans[0]._id,otherToken)).status).toBe(404);
 const data=ok(await get('/dashboard/employee-workspace',otherToken));expect(data).toMatchObject({openingCollectible:0,remainingCollectible:0,assignedCustomers:0,activeCustomers:0,target:0,collected:0});expect(data.rows).toEqual([]);
});

test('customer summary pagination and filters count assigned customers without mutating financial history',async()=>{
 const before=await financial(),response=ok(await dashboard());
 expect(new Set(response.customerRows.map(r=>r.customerId)).size).toBe(response.customerRows.length);
 expect(response.customerCounts.ALL).toBe(await Customer.countDocuments({employeeId:a._id}));
 expect(response.customerMeta.total).toBe(response.customerCounts.ALL);
 for(const key of ['TODAY','PAID','OVERDUE']){const filtered=ok(await dashboard('filter='+key));expect(filtered.customerMeta.total).toBe(response.customerCounts[key]);}
 expect(await financial()).toBe(before);
});

test('collection loan view separates each loan, counts real receipts, filters and paginates without financial writes',async()=>{
 const before=await financial(),data=ok(await get('/collections/recovery?view=LOANS&limit=100'));
 expect(new Set(data.rows.map(r=>r.loanId)).size).toBe(data.rows.length);
 expect(data.summary.totalCollectible).toBeCloseTo(data.rows.reduce((n,r)=>n+r.totalCollectible,0),2);
 for(const row of data.rows)expect(row.totalCollectible).toBeCloseTo(row.previousOverdue+row.todayUnpaid,2);
 for(const filter of ['TODAY','OVERDUE','PAID_TODAY'])expect(ok(await get('/collections/recovery?view=LOANS&limit=100&filter='+filter)).meta.total).toBe(data.counts[filter]);
 const paged=ok(await get('/collections/recovery?view=LOANS&limit=1'));expect(paged.rows.length).toBeLessThanOrEqual(1);expect(paged.meta.total).toBe(data.meta.total);
 if(data.rows.length){const row=data.rows[0];const found=ok(await get('/collections/recovery?view=LOANS&search='+encodeURIComponent(row.loanNumber)));expect(found.rows.every(r=>r.loanId===row.loanId)).toBe(true);}
 expect((await get('/collections/recovery?view=LOANS&employeeId='+a._id,otherToken)).status).toBe(403);
 expect((await get('/collections/recovery?view=LOANS&filter=INVALID')).status).toBe(422);
 expect((await get('/collections/recovery?view=LOANS&date=invalid')).status).toBe(422);
 expect(await financial()).toBe(before);
});

test('loan collection view refreshes after a valid receipt and retry creates no duplicate',async()=>{
 const customer=await Customer.create({name:'Synthetic collection refresh',customerCode:'EC-REFRESH',employeeId:a._id,createdBy:admin._id,fatherName:'Synthetic',mobile:'9800010088',age:35,occupation:'Test',address:'Test',city:'Test',area:'Test'});
 const loan=await require('../../src/services/loan.service').createLoanService({customerId:String(customer._id),loanAmount:20000,interestPercent:5,durationDays:30,loanDate:addDays(today,-1)},{id:String(a._id),role:'EMPLOYEE'}),schedule=await Schedule.findOne({loanId:loan._id}).sort({dayNumber:1});
 const path='/collections/recovery?view=LOANS&search='+loan.loanNumber,before=ok(await get(path));expect(before.rows[0].totalCollectible).toBe(700);
 const idem='ec-refresh-'+key(),receipt=ok(await pay(schedule,700,{idempotencyKey:idem}),201),after=ok(await get(path));expect(after.rows[0]).toMatchObject({totalCollectible:0,status:'Paid'});expect(after.rows[0].latestReceipt._id).toBe(receipt._id);expect(after.counts.PAID_TODAY).toBe(1);
 const repeat=await pay(schedule,700,{idempotencyKey:idem});expect([200,201]).toContain(repeat.status);expect(repeat.body.data._id).toBe(receipt._id);expect(await Collection.countDocuments({loanId:loan._id})).toBe(1);
});
