const mongoose=require('mongoose');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
jest.mock('nodemailer',()=>({createTransport:jest.fn()}));
jest.mock('../../src/utils/cache',()=>({getCache:jest.fn(),setCache:jest.fn(),invalidateCache:jest.fn()}));
const nodemailer=require('nodemailer'),mail=require('../../src/services/email.service'),worker=require('../../src/services/emailWorker.service');
const Admin=require('../../src/models/Admin'),Employee=require('../../src/models/Employee'),Settings=require('../../src/models/AccountSettings'),Challenge=require('../../src/models/EmailChallenge'),Job=require('../../src/models/EmailJob'),Inbox=require('../../src/models/UserNotification');
let mongo,admin,employee,user,delivered;
const sendMail=jest.fn(async message=>{delivered=message;return {accepted:[message.to]};});
jest.setTimeout(120000);
beforeAll(async()=>{
 Object.assign(process.env,{JWT_SECRET:'isolated-email-system-key',SMTP_HOST:'smtp.gmail.com',SMTP_PORT:'465',SMTP_USER:'sandbox@example.test',SMTP_PASS:'synthetic-only',SMTP_FROM:'Royal <sandbox@example.test>',FRONTEND_URL:'http://localhost:5173'});
 nodemailer.createTransport.mockReturnValue({sendMail,close:jest.fn()});
 mongo=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(mongo.getUri(),{dbName:'isolated_email_test'});
 admin=await Admin.create({name:'Email Admin',email:'admin@example.test',phone:'9000000000',password:'OriginalSecure123!'});
 employee=await Employee.create({name:'Email Employee',employeeCode:'EMP0001',email:'employee@example.test',phone:'9000000001',password:'OriginalSecure123!',city:'Test',area:'Test',createdBy:admin._id});
 user={id:String(employee._id),role:'EMPLOYEE'};await worker.initialize();
});
afterAll(async()=>{worker.stop();await mongoose.disconnect();if(mongo)await mongo.stop();});
beforeEach(async()=>{sendMail.mockClear();await Job.deleteMany({});await Inbox.deleteMany({});});
const code=()=>delivered.text.match(/code is (\d{6})/)[1];
async function fresh(purpose='VERIFY',role='EMPLOYEE'){
 const account=role==='ADMIN'?admin:employee;await Challenge.deleteMany({accountId:account._id});
 const challenge=await mail.requestCode(account.email,role,purpose,role==='ADMIN'?{id:String(admin._id),role}:user);return {challenge,code:code()};
}
test('OTP is keyed-hashed, expires, and is never exposed by normal database reads',async()=>{
 const value=await fresh();const hidden=await Challenge.findOne({accountId:employee._id}).lean();expect(hidden.codeHash).toBeUndefined();const secret=await Challenge.findById(value.challenge).select('+codeHash');expect(secret.codeHash).not.toContain(value.code);expect(+secret.expiresAt).toBeGreaterThan(Date.now());
 expect(delivered.html).toContain('cid:royal-logo');expect(delivered.text).not.toContain('SMTP_PASS');
});
test('unknown addresses do not send emails and cooldown survives service calls',async()=>{
 await fresh();const count=sendMail.mock.calls.length;await mail.requestCode(employee.email,'EMPLOYEE','VERIFY',user);await mail.requestCode('unknown@example.test','EMPLOYEE');expect(sendMail).toHaveBeenCalledTimes(count);
});
test('incorrect code locks after five attempts, including a subsequent correct code',async()=>{
 const value=await fresh();for(let n=0;n<5;n++)await expect(mail.confirmCode({...value,code:'000000'},user)).rejects.toThrow('Invalid');await expect(mail.confirmCode(value,user)).rejects.toThrow('Invalid');
});
test('expired code is rejected',async()=>{const value=await fresh();await Challenge.updateOne({_id:value.challenge},{$set:{expiresAt:new Date(0)}});await expect(mail.confirmCode(value,user)).rejects.toThrow('Invalid');});
test('email verification requires the exact authorized account and is single-use',async()=>{
 const value=await fresh();await expect(mail.confirmCode(value,{id:String(admin._id),role:'ADMIN'})).rejects.toThrow('Invalid');await mail.confirmCode(value,user);expect((await mail.preferences(user)).verified).toBe(true);await expect(mail.confirmCode(value,user)).rejects.toThrow('Invalid');
});
test.each(['EMPLOYEE','ADMIN'])('%s OTP resets password, revokes sessions and audits confirmation',async role=>{
 const value=await fresh('RESET',role),account=role==='ADMIN'?admin:employee;
 await expect(mail.confirmCode({...value,password:'weak',confirmPassword:'weak'})).rejects.toThrow('12');
 const result=await mail.confirmCode({...value,password:'ChangedSecurePassword123!',confirmPassword:'ChangedSecurePassword123!'});expect(result.signInRequired).toBe(true);
 const saved=await mail.accountModel(role).findById(account._id).select('+authVersion');expect(saved.authVersion).toBeGreaterThan(0);expect(await require('../../src/utils/password').comparePassword('ChangedSecurePassword123!',saved.password)).toBe(true);
 expect(await require('../../src/models/AuditLog').exists({userId:account._id,action:'PASSWORD_RESET_COMPLETED'})).toBeTruthy();
});
test('SMTP challenge failure invalidates code and hides transport secrets',async()=>{await Challenge.deleteMany({accountId:employee._id});sendMail.mockRejectedValueOnce(new Error('secret SMTP password'));await expect(mail.requestCode(employee.email,'EMPLOYEE')).rejects.toThrow('Email could not be sent');const row=await Challenge.findOne({accountId:employee._id});expect(+row.expiresAt).toBe(0);});
test('preferences validate booleans and protect Admin operational settings',async()=>{
 await mail.preferences(user,{daily:false});expect((await mail.preferences(user)).preferences.daily).toBe(false);await expect(mail.preferences(user,{daily:'false'})).rejects.toThrow('valid');await expect(worker.configuration(user)).rejects.toThrow();
 const adminUser={id:String(admin._id),role:'ADMIN'};await expect(worker.configuration(adminUser,{reminderTime:'25:90'})).rejects.toThrow('valid');const result=await worker.configuration(adminUser,{reminderTime:'09:30'});expect(result.settings.reminderTime).toBe('09:30');
});
test.each(['KYC','LOANS','SETTLEMENTS'])('%s committed notifications are queued and sent once with correct portal links',async category=>{
 const value=await fresh();await mail.confirmCode(value,user);
 const row=await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'audit:'+new mongoose.Types.ObjectId(),title:category+' update',message:'Synthetic authorized test',path:'/employee/dashboard',category});
 await worker.discover();await worker.discover();expect(await Job.countDocuments({notificationId:row._id})).toBe(1);
 const job=await Job.findOne({notificationId:row._id});await Job.deleteMany({_id:{$ne:job._id}});sendMail.mockClear();await worker.deliverOne();await worker.deliverOne();expect(sendMail).toHaveBeenCalledTimes(1);expect(delivered.html).not.toContain('http://localhost:5173/employee/dashboard');expect(delivered.text).not.toContain('http://localhost:5173');expect(delivered.text).toContain('Hi '+employee.name+',');expect((await Job.findById(job._id)).status).toBe('SENT');
});
test('unverified or changed account email cannot receive customer data',async()=>{
 await Settings.updateOne({userId:employee._id},{$unset:{emailVerifiedAt:1}});const result=await worker.content({recipientId:employee._id,role:'EMPLOYEE',kind:'EVENT'},new Date());expect(result.skip).toBe('EMAIL_NOT_VERIFIED');
});
test('optional preferences do not suppress verified security confirmations',async()=>{
 const value=await fresh();await mail.confirmCode(value,user);await mail.preferences(user,{daily:false,overdue:false,kycLoan:false,paymentSettlement:false});
 const audit=await require('../../src/models/AuditLog').create({userId:employee._id,userRole:'EMPLOYEE',userModel:'Employee',action:'PASSWORD_CHANGED',module:'AUTH'});
 const content=await worker.content({recipientId:employee._id,role:'EMPLOYEE',kind:'SECURITY',auditId:audit._id},new Date());expect(content.payload.title).toBe('Password changed successfully');
});
test('retryable SMTP failure is persisted with bounded backoff; ambiguous outcome is not resent',async()=>{
 const value=await fresh();await mail.confirmCode(value,user);
 const audit=await require('../../src/models/AuditLog').create({userId:employee._id,userRole:'EMPLOYEE',action:'PASSWORD_CHANGED',module:'AUTH'});
 const job=await Job.create({key:'retry-test',recipientId:employee._id,role:'EMPLOYEE',kind:'SECURITY',auditId:audit._id});
 sendMail.mockRejectedValueOnce(Object.assign(new Error('private host'),{code:'ECONNECTION'}));const now=new Date();await worker.deliverOne(now);let saved=await Job.findById(job._id);expect(saved.status).toBe('PENDING');expect(+saved.nextAttemptAt).toBeGreaterThan(+now);expect(saved.reason).not.toContain('private');
 sendMail.mockRejectedValueOnce(Object.assign(new Error('timeout'),{code:'ETIMEDOUT'}));await worker.deliverOne(new Date(+saved.nextAttemptAt+1));saved=await Job.findById(job._id);expect(saved.status).toBe('UNCERTAIN');const count=sendMail.mock.calls.length;await worker.deliverOne(new Date(Date.now()+3600000));expect(sendMail).toHaveBeenCalledTimes(count);
});
test('stale sending lease is quarantined instead of delivering twice after a restart',async()=>{const row=await Job.create({key:'stale',status:'SENDING',lockedAt:new Date(Date.now()-180000)});await worker.deliverOne();expect((await Job.findById(row._id)).status).toBe('UNCERTAIN');});
test('Asia/Kolkata business clock and HTML escaping are correct',()=>{
 expect(worker.clock(new Date('2026-11-04T18:31:00Z'))).toEqual({day:'2026-11-05',time:'00:01'});
 const html=require('../../src/services/emailTemplate.service').render({title:'<script>x</script>',message:'A&B',url:'https://example.test',rows:[['Customer','<img>']]}).html;expect(html).not.toContain('<script>');expect(html).toContain('&lt;img&gt;');
});
test('daily reminder reuses actual balance projection and consolidates customers, with no duplicate day job',async()=>{
 const value=await fresh();await mail.confirmCode(value,user);await mail.preferences(user,{daily:true,overdue:true});
 const dashboard=jest.spyOn(require('../../src/services/employeeDashboard.service'),'read').mockResolvedValue({customerSummaries:[{customerName:'Synthetic Customer',previousOverdue:908.35,todayDue:181.67,totalDue:1090.02,loans:[{loanNumber:'SYN-ONLY'}]},{customerName:'Fully paid',previousOverdue:0,todayDue:0,totalDue:0,loans:[]}]});
 try{const now=new Date('2026-11-05T05:00:00Z');const message=await worker.content({recipientId:employee._id,role:'EMPLOYEE',kind:'DAILY',day:'2026-11-05'},now);expect(dashboard).toHaveBeenCalledWith(user,{date:'2026-11-05',limit:1},{includeCustomerSummaries:true});expect(message.payload.rows).toContainEqual(['Total collectible','₹1,090.02']);expect(JSON.stringify(message)).not.toContain('Fully paid');await worker.discover(now);await worker.discover(now);expect(await Job.countDocuments({key:'daily:2026-11-05:'+employee._id})).toBe(1);
 }finally{dashboard.mockRestore();}
});
test('payment emails reauthorize the exact receipt and cannot leak an inaccessible payment',async()=>{
 await mail.preferences(user,{paymentSettlement:true});const enrich=jest.spyOn(require('../../src/services/paymentNotification.service'),'enrich'),receipt=jest.spyOn(require('../../src/services/collection.service'),'getCollectionReceiptService');
 const row=await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'payment-permission-test',title:'Recorded',message:'Synthetic',path:'/employee/collections/receipt/'+new mongoose.Types.ObjectId(),category:'PAYMENTS'});
 const id=String(new mongoose.Types.ObjectId());enrich.mockResolvedValue([{paymentContext:{paymentId:id},paymentId:id,title:'Customer payment verified',message:'Synthetic receipt'}]);receipt.mockRejectedValue(Object.assign(new Error('Forbidden'),{status:403}));
 try{const job={recipientId:employee._id,role:'EMPLOYEE',kind:'EVENT',notificationId:row._id};expect((await worker.content(job,new Date())).skip).toBe('ACCESS_CHANGED');receipt.mockResolvedValue({});expect((await worker.content(job,new Date())).payload.url).toContain('/employee/collections/receipt/'+id);expect(receipt).toHaveBeenCalledWith(id,user);}finally{enrich.mockRestore();receipt.mockRestore();}
});
test('concurrent delivery workers claim one job only',async()=>{
 const audit=await require('../../src/models/AuditLog').create({userId:employee._id,userRole:'EMPLOYEE',action:'PASSWORD_CHANGED',module:'AUTH'});
 await Job.create({key:'concurrent',recipientId:employee._id,role:'EMPLOYEE',kind:'SECURITY',auditId:audit._id});
 await Promise.all([worker.deliverOne(),worker.deliverOne()]);expect(sendMail).toHaveBeenCalledTimes(1);
});
test('HTTP permissions protect email settings and registered account identity',async()=>{
 const request=require('supertest'),app=require('../../src/app'),token=require('../../src/utils/jwt').generateToken(employee._id,'EMPLOYEE',(await Employee.findById(employee._id).select('+authVersion')).authVersion);
 expect((await request(app).get('/api/v1/settings/email-preferences')).status).toBe(401);
 expect((await request(app).get('/api/v1/settings/email-operations').set('Authorization','Bearer '+token)).status).toBe(403);
 expect((await request(app).patch('/api/v1/settings/email-preferences').set('Authorization','Bearer '+token).send({userId:admin._id,daily:false})).status).toBe(422);
 expect((await request(app).post('/api/v1/auth/employee/otp/request').send({email:'not-an-email',role:'SYSTEM'})).status).toBe(400);
});
test('changing the registered email invalidates prior mailbox verification',async()=>{
 const original=employee.email;try{await Employee.updateOne({_id:employee._id},{$set:{email:'changed@example.test'}});expect((await worker.content({recipientId:employee._id,role:'EMPLOYEE',kind:'EVENT'},new Date())).skip).toBe('EMAIL_NOT_VERIFIED');}finally{await Employee.updateOne({_id:employee._id},{$set:{email:original}});}
});
test('cutoff only retries a no-dues reminder once, never a sent daily reminder',async()=>{
 const day='2030-11-05';await worker.discover(new Date(day+'T05:00:00Z'));const job=await Job.findOne({key:'daily:'+day+':'+employee._id});expect(job).toBeTruthy();
 await Job.updateOne({_id:job._id},{$set:{status:'SKIPPED',reason:'NO_UNPAID_DUES'}});await worker.discover(new Date(day+'T13:00:00Z'));expect((await Job.findById(job._id)).status).toBe('PENDING');
 await Job.updateOne({_id:job._id},{$set:{status:'SENT'}});await worker.discover(new Date(day+'T14:00:00Z'));expect((await Job.findById(job._id)).status).toBe('SENT');expect(await Job.countDocuments({key:job.key})).toBe(1);
});
test('company-direct verification and dispute emails remain separate from customer receipt review',async()=>{
 const Position=require('../../src/models/CollectionPosition'),paymentId=String(new mongoose.Types.ObjectId());
 const position=jest.spyOn(Position,'findById').mockImplementation(()=>({select:()=>({lean:async()=>({employeeId:employee._id})}),lean:async()=>({employeeId:employee._id,collectionId:paymentId})}));
 const receipt=jest.spyOn(require('../../src/services/collection.service'),'getCollectionReceiptService').mockResolvedValue({});
 try{for(const action of ['COMPANY_PAYMENT_VERIFIED','COMPANY_PAYMENT_DISPUTED']){const audit=await require('../../src/models/AuditLog').create({userId:admin._id,userRole:'ADMIN',action,module:'SETTLEMENT',referenceId:String(new mongoose.Types.ObjectId())});await worker.discover();const job=await Job.findOne({auditId:audit._id});expect(job.kind).toBe('COMPANY_PAYMENT');const result=await worker.content(job,new Date());expect(result.payload.message).toContain('separate from customer payment review');expect(result.payload.url).toContain(paymentId);}}finally{position.mockRestore();receipt.mockRestore();}
});
test('malformed financial audit targets are skipped durably without poisoning the queue',async()=>{
 const row=await require('../../src/models/AuditLog').create({userId:admin._id,userRole:'ADMIN',action:'COMPANY_PAYMENT_DISPUTED',module:'SETTLEMENT',referenceId:'invalid'});await worker.discover();await worker.discover();expect(await Job.countDocuments({auditId:row._id,status:'SKIPPED'})).toBe(1);
});
test('email verification does not trigger a backlog of older customer notifications',async()=>{
 const row=await Inbox.create({recipientId:employee._id,role:'EMPLOYEE',eventKey:'audit:'+new mongoose.Types.ObjectId(),category:'KYC',title:'Old synthetic notice',message:'Synthetic only',path:'/employee/dashboard',createdAt:new Date('2020-01-01')});
 expect((await worker.content({recipientId:employee._id,role:'EMPLOYEE',kind:'EVENT',notificationId:row._id},new Date())).skip).toBe('BEFORE_EMAIL_VERIFICATION');
});
