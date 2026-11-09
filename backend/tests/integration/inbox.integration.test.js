const request=require('supertest'),mongoose=require('mongoose'),{MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('../../src/utils/logger',()=>({logAccess:jest.fn(),logError:jest.fn(),accessLoggerMiddleware:(req,res,next)=>next()}));
const app=require('../../src/app'),inbox=require('../../src/services/inbox.service'),Inbox=require('../../src/models/UserNotification'),Audit=require('../../src/models/AuditLog'),Lead=require('../../src/models/CustomerLead'),Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee');
const {generateToken}=require('../../src/utils/jwt');let repl,admin,employee,other,at,et,ot,lead;
const call=(method,url,token=et)=>request(app)[method]('/api/v1/notifications'+url).set('Authorization','Bearer '+token);
const event=action=>({userId:employee._id,userModel:'Employee',userRole:'EMPLOYEE',module:'KYC',action,referenceId:String(lead._id)});
jest.setTimeout(120000);
beforeAll(async()=>{process.env.JWT_SECRET='isolated-notification-test';repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri(),{dbName:'notifications_isolated'});admin=await Admin.create({name:'Synthetic Admin',email:'admin@inbox.test',password:'Isolated123!',phone:'9000000000'});employee=await Employee.create({name:'Synthetic Employee',employeeCode:'E1',email:'employee@inbox.test',password:'Isolated123!',phone:'9000000001',city:'Test',area:'Test',createdBy:admin._id});other=await Employee.create({name:'Other Employee',employeeCode:'E2',email:'other@inbox.test',password:'Isolated123!',phone:'9000000002',city:'Test',area:'Test',createdBy:admin._id});at=generateToken(String(admin._id),'ADMIN');et=generateToken(String(employee._id),'EMPLOYEE');ot=generateToken(String(other._id),'EMPLOYEE');lead=await Lead.create({kycVersion:1,status:'PENDING',name:'Synthetic KYC',mobile:'9300000000',submittedByEmployeeId:employee._id});await inbox.initialize();});
// Finish background index creation before the rollback test opens a transaction.
// Otherwise a collection IX lock can time out during the first transactional insert.
beforeAll(async()=>{await Audit.init();});
afterAll(async()=>{inbox.stop();await mongoose.disconnect();await repl.stop();});
test('authenticates both inbox and stream; keeps old Admin arrears endpoint protected',async()=>{expect((await request(app).get('/api/v1/notifications/inbox')).status).toBe(401);expect((await request(app).get('/api/v1/notifications/stream?token='+et)).status).toBe(401);expect((await call('get','')).status).toBe(403);});
test('persists committed events for Admin and assigned Employee; retries do not duplicate',async()=>{const row=await Audit.create(event('KYC_SUBMITTED'));await inbox.processEvents();await inbox.processEvents();expect(await Inbox.countDocuments({eventKey:'audit:'+row._id})).toBe(2);const a=(await call('get','/inbox',at)).body.data,e=(await call('get','/inbox')).body.data;expect(a.unread).toBe(1);expect(e.rows[0].path).toBe('/employee/customers/kyc/'+lead._id);expect((await call('get','/inbox',ot)).body.data.unread).toBe(0);expect(JSON.stringify(e)).not.toContain('recipientId');});
test('scopes read/unread and read-all updates to the authenticated recipient',async()=>{const e=(await call('get','/inbox')).body.data.rows[0];expect((await call('patch','/inbox/'+e._id,ot).send({unread:false})).status).toBe(404);expect((await call('patch','/inbox/'+e._id).send({unread:false})).status).toBe(200);expect((await call('get','/inbox?unread=true')).body.data.rows).toHaveLength(0);await call('patch','/inbox/'+e._id).send({unread:true});expect((await call('get','/inbox')).body.data.unread).toBe(1);await call('post','/inbox/read-all');expect((await call('get','/inbox')).body.data.unread).toBe(0);expect((await call('get','/inbox',at)).body.data.unread).toBe(1);});
test('does not notify rolled-back audits; handles late commits even after a newer event',async()=>{const session=await mongoose.startSession();session.startTransaction();const [rolled]=await Audit.create([event('KYC_REJECTED')],{session});await session.abortTransaction();await session.endSession();await inbox.processEvents();expect(await Inbox.countDocuments({eventKey:'audit:'+rolled._id})).toBe(0);const late=new Audit(event('KYC_CORRECTION_REQUIRED'));await Audit.create(event('KYC_APPROVED'));await inbox.processEvents();await late.save();await inbox.processEvents();expect(await Inbox.countDocuments({eventKey:'audit:'+late._id})).toBe(2);});
test('SSE uses Bearer authorization, delivers live invalidations and closes revoked sessions',async()=>{const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const controller=new AbortController();let reader;try{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1/notifications/stream',{headers:{Authorization:'Bearer '+et},signal:controller.signal});expect(response.headers.get('content-type')).toContain('text/event-stream');expect(response.headers.get('content-encoding')).toBeNull();reader=response.body.getReader();const decode=async()=>new TextDecoder().decode((await reader.read()).value);expect(await decode()).toContain('event: inbox');await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'synthetic-stream',title:'Test',message:'Synthetic only',path:'/employee/dashboard'});expect(await decode()).toContain('event: inbox');await Employee.updateOne({_id:employee._id},{$inc:{authVersion:1}});expect(await decode()).toContain('event: revoked');}finally{controller.abort();await reader?.cancel().catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await Employee.updateOne({_id:employee._id},{$set:{authVersion:0}});}});
test('IST due alerts include matured unpaid loans and exclude fully paid schedules; deduplicate',async()=>{const Loan=require('../../src/models/Loan'),Schedule=require('../../src/models/LoanSchedule'),Customer=require('../../src/models/Customer'),{dayStart,businessDay,addDays}=require('../../src/utils/businessDay');const customer=await Customer.create({name:'Synthetic',customerCode:'SYN1',fatherName:'Synthetic',mobile:'9300000001',age:30,occupation:'Test',address:'Test',city:'Test',area:'Test',employeeId:employee._id,createdBy:admin._id});const loan=await Loan.create({loanNumber:'SYN-1',customerId:customer._id,employeeId:employee._id,loanAmount:100,interestPercent:0,interestAmount:0,totalPayable:100,durationDays:2,dailyInstallment:50,loanDate:dayStart(addDays(businessDay(),-10)),maturityDate:dayStart(addDays(businessDay(),-8)),remainingAmount:100,remainingDays:2,createdBy:employee._id});await Schedule.create([{loanId:loan._id,dayNumber:1,date:loan.maturityDate,amount:50},{loanId:loan._id,dayNumber:2,date:loan.maturityDate,amount:50,paidAmount:50,status:'PAID'}]);await inbox.dueAlerts();await inbox.dueAlerts();const rows=await Inbox.find({recipientId:employee._id,eventKey:/^due:/});expect(rows).toHaveLength(1);expect(rows[0].path).toBe('/employee/follow-ups?loan='+loan._id);expect(await Inbox.countDocuments({recipientId:other._id,eventKey:/^due:/})).toBe(0);
 const fresh=await Loan.create({loanNumber:'SYN-2',customerId:customer._id,employeeId:employee._id,loanAmount:100,interestPercent:0,interestAmount:0,totalPayable:100,durationDays:2,dailyInstallment:50,loanDate:dayStart(addDays(businessDay(),-1)),maturityDate:dayStart(addDays(businessDay(),1)),remainingAmount:100,remainingDays:2,createdBy:employee._id});
 await Schedule.create([{loanId:fresh._id,dayNumber:1,date:dayStart(businessDay()),amount:50},{loanId:fresh._id,dayNumber:2,date:dayStart(addDays(businessDay(),1)),amount:50}]);await inbox.dueAlerts();
 const categories=await Inbox.find({recipientId:employee._id,eventKey:/^due:/});expect(categories.map(r=>r.path)).toEqual(expect.arrayContaining(['/employee/collections/today?scope=TODAY&loan=SYN-2','/employee/collections/today?scope=UPCOMING&loan=SYN-2','/employee/follow-ups?loan='+loan._id]));expect(categories).toHaveLength(3);});

test('routes loan, receipt, settlement and employee-request events to the correct authorized portal',async()=>{
 const Loan=require('../../src/models/Loan'),Collection=require('../../src/models/Collection'),Schedule=require('../../src/models/LoanSchedule'),Settlement=require('../../src/models/EmployeeSettlement'),AccountRequest=require('../../src/models/AccountRequest');
 const loan=await Loan.findOne({loanNumber:'SYN-1'}),schedule=await Schedule.findOne({loanId:loan._id});
 const payment=await Collection.create({collectionNumber:'SYN-RECEIPT',loanId:loan._id,loanScheduleId:schedule._id,customerId:loan.customerId,employeeId:employee._id,collectedBy:employee._id,amountReceived:50,expectedAmount:50,status:'PAID'});
 const settlement=await Settlement.create({employeeId:employee._id,kind:'CASH',amountMinor:100,accountId:new mongoose.Types.ObjectId(),reference:'SYNTHETIC-TRANSFER',occurredAt:new Date(),idempotencyKey:'synthetic-transfer-key',requestHash:'synthetic-only'});
 const account=await AccountRequest.create({employeeId:employee._id,kind:'PROFILE_CHANGE',reason:'Synthetic test only'});
 const events=[['LOAN_ISSUED',loan._id,'/loans/'+loan._id,'/loans/'+loan._id],['LOAN_STATUS_CHANGED',loan._id,'/loans/'+loan._id,'/loans/'+loan._id],['PAYMENT_RECEIVED',payment._id,'/collections/receipt/'+payment._id,'/collections/receipt/'+payment._id],...['SUBMITTED','VERIFIED','REJECTED','DISPUTED','REVERSED'].map(status=>['SETTLEMENT_'+status,settlement._id,'/reconciliation?settlement='+settlement._id,'/settlements?settlement='+settlement._id]),...['SUBMITTED','APPROVED','REJECTED'].map(status=>['ACCOUNT_REQUEST_'+status,account._id,'/settings?section=requests','/settings?section=requests'])];
 for(const [action,ref,adminPath,employeePath]of events){const audit=await Audit.create({...event(action),referenceId:String(ref)});await inbox.processEvents();const rows=await Inbox.find({eventKey:'audit:'+audit._id});expect(rows).toHaveLength(2);expect(rows.find(r=>r.role==='ADMIN').path).toBe('/admin'+adminPath);expect(rows.find(r=>r.role==='EMPLOYEE').path).toBe('/employee'+employeePath);expect(JSON.stringify(rows)).not.toContain('SYNTHETIC-TRANSFER');}
});

test('one malformed audit reference cannot block later committed notifications',async()=>{
 const bad=await Audit.create({...event('KYC_SUBMITTED'),referenceId:'not-an-object-id'});
 const good=await Audit.create(event('KYC_REJECTED'));
 await inbox.processEvents();
 expect(await Inbox.countDocuments({eventKey:'audit:'+bad._id})).toBe(0);
 expect(await Inbox.countDocuments({eventKey:'audit:'+good._id})).toBe(2);
});
test('temporary database errors ask SSE clients to reconnect instead of revoking a valid session',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const controller=new AbortController();let reader,spy;
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1/notifications/stream',{headers:{Authorization:'Bearer '+et},signal:controller.signal});
  reader=response.body.getReader();await reader.read();
  spy=jest.spyOn(Employee,'findById').mockImplementationOnce(()=>({select:()=>Promise.reject(new Error('Synthetic transient failure'))}));
  const next=new TextDecoder().decode((await reader.read()).value);
  expect(next).toContain('event: retry');expect(next).not.toContain('event: revoked');
 }finally{spy?.mockRestore();controller.abort();await reader?.cancel().catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('unread preview, filters, literal search, scoped counts and persistent history',async()=>{
 const total=await Inbox.countDocuments({recipientId:admin._id,role:'ADMIN'});const preview=(await call('get','/inbox?unread=true&limit=2',at)).body.data;expect(preview.rows.length).toBeLessThanOrEqual(2);expect(preview.rows.every(r=>!r.readAt)).toBe(true);expect(preview.limit).toBe(2);
 expect((await call('get','/inbox/count',at)).body.data.unread).toBe(preview.unread);
 const payments=(await call('get','/inbox?category=PAYMENTS',at)).body.data.rows;expect(payments.every(r=>r.category==='PAYMENTS')).toBe(true);
 expect((await call('get','/inbox?category=INVALID',at)).status).toBe(422);expect((await call('get','/inbox?category=__proto__',at)).status).toBe(422);expect((await call('get','/inbox?search=%5Bimpossible.*',at)).body.data.rows).toEqual([]);
 await call('post','/inbox/read-all',at);expect((await call('get','/inbox?unread=true',at)).body.data.rows).toEqual([]);expect((await call('get','/inbox',at)).body.data.total).toBe(total);
});
test('opening exact KYC validates current assignment; read retries preserve timestamp and unauthorized opens stay unread',async()=>{
 const a=await Audit.create(event('KYC_SUBMITTED'));await inbox.processEvents();const notice=await Inbox.findOne({recipientId:employee._id,eventKey:'audit:'+a._id});
 const opened=await call('post','/inbox/'+notice._id+'/open');expect(opened.status).toBe(200);expect(opened.body.data.path).toBe('/employee/customers/kyc/'+lead._id);const before=(await Inbox.findById(notice._id)).readAt;
 await call('patch','/inbox/'+notice._id).send({unread:false});expect((await Inbox.findById(notice._id)).readAt).toEqual(before);
 await call('patch','/inbox/'+notice._id).send({unread:true});await Lead.updateOne({_id:lead._id},{$set:{submittedByEmployeeId:other._id}});expect((await call('post','/inbox/'+notice._id+'/open').send({})).status).toBe(404);expect((await Inbox.findById(notice._id)).readAt).toBeNull();await Lead.updateOne({_id:lead._id},{$set:{submittedByEmployeeId:employee._id}});
});
test('approved KYC resolves exact customer and assignment notification cannot backfill old events',async()=>{
 const customer=await require('../../src/models/Customer').findOne({customerCode:'SYN1'});await Lead.updateOne({_id:lead._id},{$set:{customerId:customer._id,status:'APPROVED'}});const a=await Audit.create(event('KYC_APPROVED'));await inbox.processEvents();const n=await Inbox.findOne({recipientId:employee._id,eventKey:'audit:'+a._id});expect((await call('post','/inbox/'+n._id+'/open').send({})).body.data.path).toBe('/employee/customers/'+customer._id);
 const old=await Audit.create({...event('CUSTOMER_REASSIGNED'),referenceId:String(customer._id),createdAt:new Date(0)});await inbox.processEvents();expect(await Inbox.countDocuments({eventKey:'audit:'+old._id})).toBe(0);
 const fresh=await Audit.create({...event('CUSTOMER_REASSIGNED'),referenceId:String(customer._id)});await inbox.processEvents();const assigned=await Inbox.findOne({recipientId:employee._id,eventKey:'audit:'+fresh._id});expect(assigned.title).toBe('New Customer Assigned');expect((await call('post','/inbox/'+assigned._id+'/open').send({})).body.data.path).toBe('/employee/customers/'+customer._id);expect(await Inbox.countDocuments({recipientId:other._id,eventKey:'audit:'+fresh._id})).toBe(0);
});
test('settlement and loan notification opens revalidate exact record and ownership',async()=>{
 const loan=await require('../../src/models/Loan').findOne({loanNumber:'SYN-1'}),settlement=await require('../../src/models/EmployeeSettlement').findOne({reference:'SYNTHETIC-TRANSFER'});
 for(const [action,ref,path]of [['LOAN_ISSUED',loan._id,'/employee/loans/'+loan._id],['SETTLEMENT_VERIFIED',settlement._id,'/employee/settlements?settlement='+settlement._id]]){const a=await Audit.create({...event(action),referenceId:String(ref)});await inbox.processEvents();const n=await Inbox.findOne({recipientId:employee._id,eventKey:'audit:'+a._id});expect((await call('post','/inbox/'+n._id+'/open').send({})).body.data.path).toBe(path);expect((await call('post','/inbox/'+n._id+'/open',ot).send({})).status).toBe(404);}
});

test('history pagination is stable, searchable and scoped without dropping read records',async()=>{
 await Inbox.insertMany(Array.from({length:25},(_,i)=>({recipientId:employee._id,role:'EMPLOYEE',eventKey:'isolated-paging-'+i,title:'Isolated paging '+i,message:'Synthetic notification only',path:'/employee/dashboard',category:'SYSTEM',createdAt:new Date('2026-01-01')})));
 const a=(await call('get','/inbox?search=Isolated%20paging&limit=10&page=1')).body.data,b=(await call('get','/inbox?search=Isolated%20paging&limit=10&page=2')).body.data;expect(a.total).toBe(25);expect(a.totalPages).toBe(3);expect(a.rows).toHaveLength(10);expect(b.rows).toHaveLength(10);expect(a.rows.some(r=>b.rows.some(s=>s._id===r._id))).toBe(false);expect((await call('get','/inbox?search=Isolated%20paging',ot)).body.data.total).toBe(0);
});
test('two live tabs observe read changes and a reconnected stream resynchronizes persisted state',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const controllers=[new AbortController(),new AbortController()],readers=[];
 const live=async reader=>{for(let i=0;i<8;i++){const text=new TextDecoder().decode((await reader.read()).value);if(text.includes('event: inbox'))return text;}throw Error('No inbox update');};
 try{for(const c of controllers){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1/notifications/stream',{headers:{Authorization:'Bearer '+et},signal:c.signal});const reader=response.body.getReader();readers.push(reader);await live(reader);}
 const n=await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'isolated-two-tabs',title:'Two tabs',message:'Synthetic notification',path:'/employee/dashboard'});await Promise.all(readers.map(live));await call('patch','/inbox/'+n._id).send({unread:false});await Promise.all(readers.map(live));expect((await Inbox.findById(n._id)).readAt).toBeTruthy();
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1/notifications/stream',{headers:{Authorization:'Bearer '+et},signal:controllers[0].signal}),reader=response.body.getReader();readers.push(reader);await live(reader);expect((await call('get','/inbox?unread=true')).body.data.rows.some(r=>r._id===String(n._id))).toBe(false);
 }finally{controllers.forEach(c=>c.abort());await Promise.all(readers.map(r=>r.cancel().catch(()=>{})));server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('legacy customer requests and employee account requests resolve exact records with scoped filters',async()=>{
 const legacy=await Lead.create({name:'Synthetic legacy request',fatherName:'Synthetic',age:35,occupation:'Test',address:'Test',city:'Test',area:'Test',mobile:'9300000099',submittedByEmployeeId:employee._id,status:'PENDING'}),account=await require('../../src/models/AccountRequest').findOne({employeeId:employee._id});
 for(const [action,ref,adminPath,employeePath]of [['CUSTOMER_REQUEST_SUBMITTED',legacy._id,'/admin/customers/requests?request='+legacy._id,'/employee/inbox?request='+legacy._id],['ACCOUNT_REQUEST_SUBMITTED',account._id,'/admin/settings?section=requests&request='+account._id,'/employee/settings?section=requests&request='+account._id]]){const a=await Audit.create({...event(action),referenceId:String(ref)});await inbox.processEvents();for(const [auth,recipient,path]of [[at,admin,adminPath],[et,employee,employeePath]]){const n=await Inbox.findOne({recipientId:recipient._id,eventKey:'audit:'+a._id});expect((await call('post','/inbox/'+n._id+'/open',auth).send({})).body.data.path).toBe(path);}}
 const own=await request(app).get('/api/v1/settings/requests?requestId='+account._id).set('Authorization','Bearer '+et),foreign=await request(app).get('/api/v1/settings/requests?requestId='+account._id).set('Authorization','Bearer '+ot);expect(own.body.data.rows).toHaveLength(1);expect(own.body.data.rows[0]._id).toBe(String(account._id));expect(foreign.body.data.rows).toEqual([]);
});
test('reminder destinations resolve the saved exact loan without substituting another overdue case',async()=>{
 const n=await Inbox.findOne({recipientId:employee._id,kind:'INSTALLMENT_OVERDUE'});expect(n).toBeTruthy();expect((await call('post','/inbox/'+n._id+'/open').send({})).body.data.path).toBe('/employee/follow-ups?loan='+n.loanId);expect((await call('post','/inbox/'+n._id+'/open',ot).send({})).status).toBe(404);
});
// Soft dismissal is inbox state only; no source or financial record is removed.
test('dismiss and Undo persist per recipient, preserve read state and never delete source records',async()=>{
 const own=await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'dismiss-regression',title:'Dismissible synthetic notice',message:'Synthetic only',path:'/employee/dashboard',category:'SYSTEM'});
 const models=['Customer','Loan','LoanSchedule','Collection','CollectionPosition','EmployeeSettlement','CashBook','CustomerLead','AuditLog'];
 const snapshot=async()=>JSON.stringify(await Promise.all(models.map(name=>require('../../src/models/'+name).find({}).sort({_id:1}).lean())));const before=await snapshot();
 for(const token of [ot,at]){expect((await call('post','/inbox/'+own._id+'/dismiss',token)).status).toBe(404);expect((await call('post','/inbox/'+own._id+'/restore',token)).status).toBe(404);}
 expect((await request(app).post('/api/v1/notifications/inbox/'+own._id+'/dismiss')).status).toBe(401);
 const unread=(await call('get','/inbox')).body.data.unread;
 expect((await call('post','/inbox/'+own._id+'/dismiss')).status).toBe(200);
 expect((await call('get','/inbox')).body.data.unread).toBe(unread-1);
 expect((await call('get','/inbox?search=Dismissible')).body.data.rows).toHaveLength(0);
 expect((await call('get','/inbox/count')).body.data.unread).toBe(unread-1);
 expect((await call('post','/inbox/'+own._id+'/open').send({})).status).toBe(404);
 await call('post','/inbox/read-all');expect((await Inbox.findById(own._id)).readAt).toBeUndefined();
 expect((await call('post','/inbox/'+own._id+'/restore')).status).toBe(200);
 const restored=(await call('get','/inbox?search=Dismissible')).body.data.rows;expect(restored).toHaveLength(1);expect(restored[0].readAt).toBeUndefined();expect(await Inbox.countDocuments({_id:own._id})).toBe(1);
 expect((await call('post','/inbox/'+own._id+'/open').send({})).body.data.path).toBe('/employee/dashboard');expect(await snapshot()).toBe(before);
});
test('four UI groups cover legacy/current categories with scoped counts and preserved detailed filters',async()=>{
 const prior=(await call('get','/inbox')).body.data.groups;
 const categories=['PAYMENTS','SETTLEMENTS','LOANS','REMINDERS','KYC','SYSTEM',null];let serial=0;
 const created=[];for(const category of categories)created.push(await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'group-regression-'+serial++,title:'GROUP_QA '+serial,message:'Synthetic category notice',path:'/employee/dashboard',...(category?{category}:{kind:'PAYMENT_RECORDED'})}));
 const groups=(await call('get','/inbox')).body.data.groups;expect(groups).toEqual({ALL:prior.ALL+7,PAYMENTS:prior.PAYMENTS+3,LOANS:prior.LOANS+2,SYSTEM:prior.SYSTEM+2});
 for(const [group,expected]of [['PAYMENTS',3],['LOANS',2],['SYSTEM',2]])expect((await call('get','/inbox?group='+group+'&search=GROUP_QA')).body.data.rows).toHaveLength(expected);
 expect((await call('get','/inbox?group=PAYMENTS&category=SETTLEMENTS&search=GROUP_QA')).body.data.rows).toHaveLength(1);
 expect((await call('get','/inbox?search=GROUP_QA',ot)).body.data.total).toBe(0);expect((await call('get','/inbox?group=invalid')).status).toBe(422);
 await call('post','/inbox/'+created[0]._id+'/dismiss');expect((await call('get','/inbox')).body.data.groups.PAYMENTS).toBe(groups.PAYMENTS-1);
});
test('dismissed audit notifications are not resurrected or duplicated by event retries',async()=>{
 const audit=await Audit.create(event('KYC_SUBMITTED'));await inbox.processEvents();const row=await Inbox.findOne({recipientId:employee._id,eventKey:'audit:'+audit._id});expect(row).toBeTruthy();await call('post','/inbox/'+row._id+'/dismiss');const dismissed=await Inbox.findById(row._id).lean();await inbox.processEvents();await inbox.processEvents();expect(await Inbox.countDocuments({recipientId:employee._id,eventKey:'audit:'+audit._id})).toBe(1);expect((await Inbox.findById(row._id)).dismissedAt).toEqual(dismissed.dismissedAt);expect((await call('get','/inbox?limit=50')).body.data.rows.some(r=>r._id===String(row._id))).toBe(false);
});
test('SSE invalidates connected devices after dismissal and restore',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const controller=new AbortController();let reader;
 const next=async()=>{for(let i=0;i<6;i++){if(new TextDecoder().decode((await reader.read()).value).includes('event: inbox'))return;}throw Error('No notification invalidation');};
 try{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1/notifications/stream',{headers:{Authorization:'Bearer '+et},signal:controller.signal});reader=response.body.getReader();await next();const row=await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'live-dismiss',title:'Live synthetic notice',message:'Synthetic only',path:'/employee/dashboard'});await next();await call('post','/inbox/'+row._id+'/dismiss');await next();await call('post','/inbox/'+row._id+'/restore');await next();}finally{controller.abort();await reader?.cancel().catch(()=>{});server.closeAllConnections();await new Promise(r=>server.close(r));}
});
