const Job=require('../models/EmailJob'),Control=require('../models/EmailControl'),Inbox=require('../models/UserNotification');
const Settings=require('../models/AccountSettings'),Company=require('../models/CompanySettings');
const mail=require('./email.service');
const operationDefaults={reminderTime:'09:00',cutoffTime:'18:00',daily:true,overdue:true,kycLoan:true,paymentSettlement:true};
const group=category=>['PAYMENTS','SETTLEMENTS'].includes(category)?'paymentSettlement':['KYC','LOANS','CUSTOMERS','SYSTEM'].includes(category)?'kycLoan':null;
function clock(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
async function configuration(user,body){
 await require('./settlement.service').authorize(user,true);
 if(body!==undefined){if(!body||Array.isArray(body)||Object.entries(body).some(([k,v])=>!Object.hasOwn(operationDefaults,k)||(k.endsWith('Time')?(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)):typeof v!=='boolean')))throw Object.assign(new Error('Choose valid email categories and 24-hour reminder times'),{status:422});
 await Company.updateOne({_id:'company'},{$set:Object.fromEntries(Object.entries(body).map(([k,v])=>['emailSettings.'+k,v]))},{upsert:true});}
 const company=await Company.findById('company').lean();return {settings:{...operationDefaults,...company?.emailSettings},timeZone:'Asia/Kolkata',configured:Boolean(require('./passwordRecovery.service').emailConfiguration()),verificationRequired:true};
}
async function initialize(){await Promise.all([Job.init(),Control.init()]);return Control.findOneAndUpdate({_id:'email-v1'},{$setOnInsert:{startedAt:new Date()}},{upsert:true,returnDocument:'after'});}
async function enqueue(value){try{await Job.updateOne({key:value.key},{$setOnInsert:value},{upsert:true});}catch(error){if(error.code!==11000)throw error;}}
async function discover(now=new Date()){
 const control=await initialize();
 // Notifications already persist each audited event with its authorized recipient.
 const rows=await Inbox.aggregate([{$match:{createdAt:{$gte:control.startedAt},eventKey:/^audit:/,$or:[{category:{$in:['PAYMENTS','SETTLEMENTS','KYC','LOANS','CUSTOMERS']}},{kind:/^ACCOUNT_REQUEST_/}]}},{$lookup:{from:Job.collection.name,localField:'_id',foreignField:'notificationId',as:'emailJobs'}},{$match:{'emailJobs.0':{$exists:false}}},{$sort:{_id:1}},{$limit:100}]);
 for(const row of rows)await enqueue({key:'inbox:'+row._id,notificationId:row._id,recipientId:row.recipientId,role:row.role,kind:'EVENT'});
 const audits=await require('../models/AuditLog').aggregate([{$match:{createdAt:{$gte:control.startedAt},action:{$in:['PASSWORD_CHANGED','PASSWORD_RESET_COMPLETED','EMPLOYEE_PASSWORD_RESET_COMPLETED','ALL_SESSIONS_REVOKED','COMPANY_PAYMENT_VERIFIED','COMPANY_PAYMENT_DISPUTED','COMPANY_VERIFICATION_REVERSED']}}},{$lookup:{from:Job.collection.name,localField:'_id',foreignField:'auditId',as:'emailJobs'}},{$match:{'emailJobs.0':{$exists:false}}},{$sort:{_id:1}},{$limit:100}]);
 for(const row of audits){
  if(/^COMPANY_/.test(row.action)){
   const valid=require('mongoose').isValidObjectId(row.referenceId);
   const position=valid?await require('../models/CollectionPosition').findById(row.referenceId).select('employeeId').lean():null;
   if(!position){await enqueue({key:'ignored:'+row._id,auditId:row._id,status:'SKIPPED',reason:'SOURCE_UNAVAILABLE'});continue;}
   if(position)await enqueue({key:'company-payment:'+row._id,auditId:row._id,recipientId:position.employeeId,role:'EMPLOYEE',kind:'COMPANY_PAYMENT'});
  }else{const role=row.action==='EMPLOYEE_PASSWORD_RESET_COMPLETED'||row.userRole==='EMPLOYEE'?'EMPLOYEE':'ADMIN',recipientId=row.action==='EMPLOYEE_PASSWORD_RESET_COMPLETED'?row.referenceId:row.userId;if(!recipientId){await enqueue({key:'ignored:'+row._id,auditId:row._id,status:'SKIPPED',reason:'SOURCE_UNAVAILABLE'});continue;}if(recipientId)await enqueue({key:'security:'+row._id,auditId:row._id,recipientId,role,kind:'SECURITY'});}
 }
 const company=await Company.findById('company').lean(),config={...operationDefaults,...company?.emailSettings},time=clock(now);
 if(time.time>=config.reminderTime||time.time>=config.cutoffTime){
  const verified=await Settings.find({role:'EMPLOYEE',emailVerifiedAt:{$exists:true}}).select('userId').lean();
  if(time.time>=config.cutoffTime)await Job.updateMany({kind:'DAILY',day:time.day,status:'SKIPPED',reason:'NO_UNPAID_DUES',cutoffChecked:{$ne:true}},{$set:{status:'PENDING',cutoffChecked:true,nextAttemptAt:now}});
  for(const account of verified)await enqueue({key:`daily:${time.day}:${account.userId}`,recipientId:account.userId,role:'EMPLOYEE',day:time.day,kind:'DAILY',cutoffChecked:time.time>=config.cutoffTime});
 }
}
const rupees=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value||0);
const stamp=require('./emailTemplate.service').dateLabel;
const detailMoney=value=>typeof value==='number'&&Number.isFinite(value)?rupees(value):'Not recorded';
const saved=value=>value===undefined||value===null||value===''?'Not recorded':String(value);
async function eventDetails(row,payment){
 if(payment)return [['Amount received',detailMoney(payment.amount)],['Customer',saved(payment.customer?.name)],['Loan number',saved(payment.loan?.number)],['Receipt number',saved(payment.receipt)],['Actual payment received',stamp(payment.receivedAt)||'Not recorded'],['Payment method',saved(payment.mode)],['Customer receipt review',row.kind==='PAYMENT_VERIFIED'?'Verified by Admin':'Recorded — awaiting Admin review'],['Company settlement','Reviewed separately in the secure portal']];
 if(row.kycRequestId){const lead=await require('../models/CustomerLead').findById(row.kycRequestId).select('name status').lean();if(lead)return [['Customer',saved(lead.name)],['Application reference',String(lead._id)],['Current application status',lead.status==='PENDING'?'Pending Approval':saved(lead.status).replaceAll('_',' ')]];}
 if(row.settlementId){const s=await require('../models/EmployeeSettlement').findById(row.settlementId).select('amountMinor reference status kind occurredAt').lean();if(s)return [['Settlement amount',rupees(s.amountMinor/100)],['Settlement reference',s.reference||String(s._id)],['Current settlement status',saved(s.status)],['Settlement type',saved(s.kind)],['Reported transfer / handover',stamp(s.occurredAt)||'Not recorded']];}
 if(row.category==='LOANS'&&row.loanId){const loan=await require('../models/Loan').findById(row.loanId).select('loanNumber loanAmount status loanDate').lean();if(loan)return [['Loan number',saved(loan.loanNumber)],['Principal amount',detailMoney(loan.loanAmount)],['Current loan status',saved(loan.status)],['Actual issue date',stamp(loan.loanDate)||'Not recorded']];}
 return [];
}
async function content(job,now){
 const account=await mail.accountModel(job.role).findOne({_id:job.recipientId,...mail.active(job.role)}).lean();if(!account)return {skip:'ACCOUNT_UNAVAILABLE'};
 const setting=await Settings.findOne({userId:job.recipientId,role:job.role}).select('+emailVerifiedHash').lean();
 if(!setting?.emailVerifiedAt||setting.emailVerifiedHash!==mail.digest(account.email.toLowerCase()))return {skip:'EMAIL_NOT_VERIFIED'};
 const preferences={...mail.defaults,...setting.emailPreferences},company=await Company.findById('company').lean(),config={...operationDefaults,...company?.emailSettings};
 const base=require('./passwordRecovery.service').emailConfiguration()?.origin;if(!base)return {skip:'EMAIL_NOT_CONFIGURED'};
 const user={id:String(account._id),role:job.role};let payload;
 if(job.kind==='SECURITY'){
  const audit=await require('../models/AuditLog').findById(job.auditId).lean();if(!audit)return {skip:'SOURCE_UNAVAILABLE'};
  payload={title:audit.action.includes('RESET')?'Password reset completed':audit.action==='PASSWORD_CHANGED'?'Password changed successfully':'Account security alert',message:'Your account security settings changed. If you did not make this change, contact Admin immediately.',category:'SECURITY',rows:[['Security event',audit.action.replaceAll('_',' ')],['Occurred at',stamp(audit.createdAt)||'Not recorded']],url:base+'/'+job.role.toLowerCase()+'/login',actionLabel:'Sign in securely'};
 }else if(job.kind==='COMPANY_PAYMENT'){
  if(!preferences.paymentSettlement||!config.paymentSettlement)return {skip:'PREFERENCE_DISABLED'};
  const audit=await require('../models/AuditLog').findById(job.auditId).lean();
  const position=audit&&require('mongoose').isValidObjectId(audit.referenceId)?await require('../models/CollectionPosition').findById(audit.referenceId).lean():null;
  if(!position||String(position.employeeId)!==user.id)return {skip:'ACCESS_CHANGED'};
  try{await require('./collection.service').getCollectionReceiptService(String(position.collectionId),user);}catch{return {skip:'ACCESS_CHANGED'};}
  payload={title:audit.action==='COMPANY_PAYMENT_VERIFIED'?'Company-direct funds verified':'Company-direct funds require review',message:'Admin updated verification of money received directly by the company. This is separate from customer payment review and employee settlement.',category:'PAYMENTS',rows:[['Company-direct amount',rupees(position.amountMinor/100)],['Current company funds review',saved(position.verification)],['Actual payment received',stamp(position.paymentDate)||'Not recorded']],url:base+'/employee/collections/receipt/'+position.collectionId,actionLabel:'View payment receipt'};
 }else if(job.kind==='DAILY'){
  if(job.day!==clock(now).day)return {skip:'REMINDER_EXPIRED'};
  if(!(preferences.daily&&config.daily)&&!(preferences.overdue&&config.overdue))return {skip:'PREFERENCE_DISABLED'};
  const dashboard=await require('./employeeDashboard.service').read(user,{date:job.day,limit:1},{includeCustomerSummaries:true});
  const customers=(dashboard.customerSummaries||[]).filter(c=>c.totalDue>0&&((preferences.daily&&config.daily&&c.todayDue>0)||(preferences.overdue&&config.overdue&&c.previousOverdue>0)));
  if(!customers.length)return {skip:'NO_UNPAID_DUES'};
  payload={title:'Daily collection and overdue reminder',message:`Unpaid collections for ${job.day} (Asia/Kolkata). ${customers.length} customer(s) have unpaid dues; up to 50 are listed below. Open the portal for the complete list. Previous overdue and today's unpaid balances exclude existing allocations.`,url:base+'/employee/collections/today',rows:customers.slice(0,50).flatMap(c=>[
   [c.customerName,(c.loans||[]).filter(l=>l.remaining===undefined||l.remaining>0).map(l=>l.loanNumber).join(', ')],...(c.loans||[]).filter(l=>l.currentSchedule?.dueDate).map(l=>['Installment due · '+l.loanNumber,stamp(l.currentSchedule.dueDate)]),['Previous overdue',rupees(c.previousOverdue)],["Today's unpaid",rupees(c.todayDue)],['Total collectible',rupees(c.totalDue)]]),actionLabel:'View collection dues',category:'REMINDERS'};
 }else{
  const row=await Inbox.findById(job.notificationId).lean();if(!row)return {skip:'SOURCE_UNAVAILABLE'};
  if(+row.createdAt<+setting.emailVerifiedAt)return {skip:'BEFORE_EMAIL_VERIFICATION'};
  const category=group(row.category);if(!category||!preferences[category]||!config[category])return {skip:'PREFERENCE_DISABLED'};
  // Resolve again at dispatch time: stale assignment notifications must not disclose a former customer's data.
  let target,paymentContext;try{if(row.category==='PAYMENTS'){const [payment]=await require('./paymentNotification.service').enrich([row],user);if(!payment.paymentContext)return {skip:'ACCESS_CHANGED'};await require('./collection.service').getCollectionReceiptService(payment.paymentId,user);target='/'+user.role.toLowerCase()+'/collections/receipt/'+payment.paymentId;row.title=payment.title;row.message=payment.message;row.kind=payment.kind||row.kind;paymentContext=payment.paymentContext;}else target=await require('./notificationTarget.service').resolve(row,user);}catch{return {skip:'ACCESS_CHANGED'};}
  payload={title:/REJECTED$/.test(row.kind||'')&&row.category==='KYC'?'Customer KYC rejected':row.title,message:/REJECTED$/.test(row.kind||'')&&row.category==='KYC'?'The customer application was rejected. Sign in to the secure application to review Admin remarks.':row.message,url:base+target,category:row.category,rows:await eventDetails(row,paymentContext),actionLabel:row.category==='KYC'?'View KYC application':row.category==='PAYMENTS'?'View payment receipt':row.category==='SETTLEMENTS'?'Review settlement':'Open secure portal'};
 }
 return {to:account.email,payload:{...payload,recipientName:account.name}};
}
async function deliverOne(now=new Date()){
 // A crash during email delivery can have an unknown delivery outcome. Never blindly resend it.
 await Job.updateMany({status:'SENDING',lockedAt:{$lt:new Date(+now-120000)}},{$set:{status:'UNCERTAIN',reason:'DELIVERY_OUTCOME_UNKNOWN'}});
 const job=await Job.findOneAndUpdate({status:'PENDING',nextAttemptAt:{$lte:now}},{$set:{status:'SENDING',lockedAt:now},$inc:{attempts:1}},{sort:{createdAt:1},returnDocument:'after'}).lean();if(!job)return false;
 try{const message=await content(job,now);if(message.skip){await Job.updateOne({_id:job._id},{$set:{status:'SKIPPED',reason:message.skip}});return true;}
  await mail.send(message.to,message.payload,job.key);await Job.updateOne({_id:job._id},{$set:{status:'SENT',sentAt:new Date()},$unset:{reason:1}});
 }catch(error){
  const safeRetry=['ECONNECTION','EDNS','ECONNREFUSED'].includes(error.code)||(error.responseCode>=400&&error.responseCode<500);
  await Job.updateOne({_id:job._id},{$set:{status:safeRetry&&job.attempts<5?'PENDING':safeRetry||error.responseCode>=500?'FAILED':'UNCERTAIN',reason:safeRetry?'TEMPORARY_DELIVERY_FAILURE':'DELIVERY_REQUIRES_REVIEW',nextAttemptAt:new Date(+now+Math.min(3600000,30000*2**job.attempts))}});
 }
 return true;
}
let busy=false,timer;
async function tick(){if(busy||!require('./passwordRecovery.service').emailConfiguration())return;busy=true;try{await discover();for(let i=0;i<20;i++)if(!await deliverOne())break;}finally{busy=false;}}
function start(){if(timer)return;timer=setInterval(()=>tick().catch(()=>console.error('Email worker failed; no recipient details logged')),30000);timer.unref();tick().catch(()=>console.error('Email worker initialization failed'));}
function stop(){clearInterval(timer);timer=null;}
module.exports={initialize,discover,deliverOne,content,configuration,clock,group,start,stop,tick};
