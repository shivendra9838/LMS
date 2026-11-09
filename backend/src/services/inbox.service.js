const mongoose=require('mongoose');
const Inbox=require('../models/UserNotification'), Dispatch=require('../models/NotificationDispatch'),Audit=require('../models/AuditLog');
const Admin=require('../models/Admin'),Employee=require('../models/Employee');
const {businessDay,dayStart,addDays}=require('../utils/businessDay');
const id=v=>String(v?._id||v);
const scope=user=>({recipientId:user.id,role:user.role});
async function put(user,eventKey,title,message,path,extra={}){
 try{await Inbox.updateOne({...scope(user),eventKey},{$setOnInsert:{title,message,path,...extra,createdAt:new Date(),updatedAt:new Date()}},{upsert:true,timestamps:false});}catch(e){if(e.code!==11000)throw e;}
}
async function admins(){return (await Admin.find({isActive:true}).select('_id')).map(a=>({id:id(a),role:'ADMIN'}));}
async function employee(value){if(!mongoose.isValidObjectId(value))return null;const e=await Employee.findOne({_id:value,status:'ACTIVE'}).select('_id');return e?{id:id(e),role:'EMPLOYEE'}:null;}
async function dispatch(event){
 const action=event.action, ref=event.referenceId;let target,employeeId,path,employeePath,title;
 // Invalid audit targets must not poison the durable delivery queue.
 if(typeof ref!=='string'||!mongoose.isValidObjectId(ref))return;
 if(/^KYC_(SUBMITTED|APPROVED|REJECTED|CORRECTION_REQUIRED)$/.test(action)||/^CUSTOMER_REQUEST_(SUBMITTED|APPROVED|REJECTED)$/.test(action)){
  target=await require('../models/CustomerLead').findById(ref).lean();if(!target)return;
  employeeId=target.customerId?(await require('../models/Customer').findById(target.customerId).select('employeeId'))?.employeeId:target.submittedByEmployeeId;
  path=target.kycVersion?'/customers/kyc/'+ref:'/customers/requests';employeePath=target.kycVersion?path:'/customers';title=action.replace(/^KYC_/,'KYC ').replace(/^CUSTOMER_REQUEST_/,'Customer request ').replaceAll('_',' ');
 }else if(action==='CUSTOMER_REASSIGNED'){
  target=await require('../models/Customer').findById(ref).lean();if(!target)return;employeeId=target.employeeId;path='/customers/'+ref;title='New Customer Assigned';
 }else if(action==='OVERDUE_FOLLOW_UP_RECORDED'){
  target=await require('../models/OverdueFollowUp').findById(ref).lean();if(!target)return;const loan=await require('../models/Loan').findById(target.loanId).select('employeeId');if(!loan)return;employeeId=loan.employeeId;path='/follow-ups?loan='+target.loanId;title='Overdue follow-up recorded';
 }else if(['LOAN_ISSUED','LOAN_STATUS_CHANGED'].includes(action)){
  target=await require('../models/Loan').findById(ref).lean();if(!target)return;employeeId=target.employeeId;path='/loans/'+ref;title=action==='LOAN_ISSUED'?'New Loan Created':'Loan status updated';
 }else if(['PAYMENT_RECEIVED','CUSTOMER_PAYMENT_VERIFIED'].includes(action)){
  target=await require('../models/Collection').findById(ref).lean();if(!target)return;employeeId=target.employeeId;path='/collections/receipt/'+ref;title=action==='CUSTOMER_PAYMENT_VERIFIED'?'Customer payment verified':'Payment recorded';
 }else if(/^SETTLEMENT_(SUBMITTED|VERIFIED|REJECTED|DISPUTED|REVERSED)$/.test(action)){
  target=await require('../models/EmployeeSettlement').findById(ref).lean();if(!target)return;employeeId=target.employeeId;path='/reconciliation?settlement='+ref;employeePath='/settlements?settlement='+ref;title=action.replaceAll('_',' ');
 }else if(/^ACCOUNT_REQUEST_(SUBMITTED|APPROVED|REJECTED)$/.test(action)){
  target=await require('../models/AccountRequest').findById(ref).lean();if(!target)return;employeeId=target.employeeId;path='/settings?section=requests';title=action.replaceAll('_',' ');
 }else return;
 const recipients=await admins();const e=await employee(employeeId);if(e)recipients.push(e);
 for(const user of recipients){const suffix=user.role==='EMPLOYEE'?(employeePath||path):path,fullPath='/'+user.role.toLowerCase()+suffix;let message='Open the record to view its details and any review remarks.',extra={kind:action,category:require('./notificationTarget.service').category({kind:action,path:fullPath}),employeeId};
  if(action.startsWith('KYC_')||action.startsWith('CUSTOMER_REQUEST_')){extra.kycRequestId=target._id;extra.customerId=target.customerId;const owner=await Employee.findById(target.submittedByEmployeeId).select('name').lean();const name=target.name||'Customer';title=action.includes('SUBMITTED')?(target.kycVersion?'Customer KYC Submitted':'New Customer Request'):action.includes('APPROVED')?'Customer KYC Approved':'KYC Requires Correction';message=action.includes('SUBMITTED')?`${owner?.name||'Employee'} submitted ${name}'s application.`:action.includes('APPROVED')?`${name}'s KYC has been approved by Admin.`:`${name}'s KYC requires changes. Open the application for Admin remarks.`;}
  if(action==='CUSTOMER_REASSIGNED'){extra.customerId=target._id;const assigned=await Employee.findById(employeeId).select('name').lean();message=user.role==='EMPLOYEE'?`Customer ${target.name} has been assigned to you.`:`Customer ${target.name} has been assigned to ${assigned?.name||'the employee'}.`;}
  if(action.startsWith('LOAN_')){extra.loanId=target._id;extra.customerId=target.customerId;const [c,e]=await Promise.all([require('../models/Customer').findById(target.customerId).select('name').lean(),Employee.findById(employeeId).select('name').lean()]);message=action==='LOAN_ISSUED'?`${e?.name||'Employee'} issued loan ${target.loanNumber} to ${c?.name||'the customer'}.`:`Loan ${target.loanNumber} was updated for ${c?.name||'the customer'}.`;}
  if(action.startsWith('SETTLEMENT_')){extra.settlementId=target._id;const e=await Employee.findById(employeeId).select('name').lean();const amount=(target.amountMinor/100).toLocaleString('en-IN',{style:'currency',currency:'INR'});title=action==='SETTLEMENT_SUBMITTED'?'Settlement Awaiting Verification':action==='SETTLEMENT_VERIFIED'?'Settlement Verified':action==='SETTLEMENT_REJECTED'?'Settlement Requires Attention':title.replaceAll('_',' ').toLowerCase();message=`${e?.name||'Employee'} · ${amount} · ${action==='SETTLEMENT_REJECTED'?'Open submission for Admin remarks.':'Open the settlement record.'}`;}
  if(['PAYMENT_RECEIVED','CUSTOMER_PAYMENT_VERIFIED'].includes(action)){const [enriched]=await require('./paymentNotification.service').enrich([{eventKey:'audit:'+id(event),title,path:fullPath,paymentId:ref,kind:action==='PAYMENT_RECEIVED'?'PAYMENT_RECORDED':'PAYMENT_VERIFIED'}],user);if(!enriched.paymentContext)continue;title=enriched.title;message=enriched.message;extra={...extra,paymentId:ref,kind:enriched.kind,category:'PAYMENTS'};}
  await put(user,'audit:'+id(event),title,message,fullPath,extra);
 }
}
let processing=false,timer,lastDue=0;
async function initialize(){await Promise.all([Inbox.init(),Dispatch.init()]);await Dispatch.updateOne({_id:'activation'},{$setOnInsert:{startedAt:new Date()}},{upsert:true});await Dispatch.updateOne({_id:'smart-v1'},{$setOnInsert:{startedAt:new Date()}},{upsert:true});}
async function dueAlerts(){
 const today=businessDay(),end=dayStart(addDays(today,2)),start=dayStart(today),tomorrow=dayStart(addDays(today,1)),adminUsers=await admins();
 const rows=await require('../models/LoanSchedule').aggregate([{$match:{date:{$lt:end},$expr:{$lt:[require('../utils/money').mongoMinor('$paidAmount'),require('../utils/money').mongoMinor('$amount')]}}},{$lookup:{from:'loans',localField:'loanId',foreignField:'_id',as:'loan'}},{$unwind:'$loan'},{$match:{'loan.status':{$in:['ACTIVE','DEFAULTED']},'loan.remainingAmount':{$gt:0}}},{$group:{_id:{loan:'$loanId',category:{$switch:{branches:[{case:{$lt:['$date',start]},then:'OVERDUE'},{case:{$lt:['$date',tomorrow]},then:'TODAY'}],default:'UPCOMING'}}},employeeId:{$first:'$loan.employeeId'},customerId:{$first:'$loan.customerId'},loanNumber:{$first:'$loan.loanNumber'},remaining:{$sum:{$subtract:[require('../utils/money').mongoMinor('$amount'),require('../utils/money').mongoMinor('$paidAmount')]}}}}]);
 for(const row of rows){const user=await employee(row.employeeId),customer=await require('../models/Customer').findById(row.customerId).select('name').lean(),key='due:'+today+':'+row._id.category+':'+row._id.loan,amount=require('../utils/money').major(row.remaining).toLocaleString('en-IN',{style:'currency',currency:'INR'}),message=`${customer?.name||'Customer'} · ${amount} unpaid · Loan ${row.loanNumber}`,extra={category:'REMINDERS',kind:'INSTALLMENT_'+row._id.category,loanId:row._id.loan,customerId:row.customerId,employeeId:row.employeeId};
 if(user)await put(user,key,row._id.category==='OVERDUE'?'Collection Overdue':row._id.category==='TODAY'?'Installments due today':'Upcoming installments',message,row._id.category==='OVERDUE'?'/employee/follow-ups?loan='+row._id.loan:'/employee/collections/today?scope='+row._id.category+'&loan='+encodeURIComponent(row.loanNumber),extra);
 if(row._id.category==='OVERDUE')for(const admin of adminUsers)await put(admin,key,'Overdue Installment',message,'/admin/follow-ups?loan='+row._id.loan,extra);
 }
}

async function followUpAlerts(){
 const today=businessDay(),rows=await require('./followUp.service').overdueCases(),adminUsers=await admins();

 for(const row of rows){if(!row.latest||!row.pending)continue;const user=await employee(row.employeeId),key='follow-up:'+id(row.latest)+':'+today+':'+(row.missed?'MISSED':'DUE');if(user)await put(user,key,row.missed?'Missed follow-up or payment promise':'Scheduled follow-up due',`${row.customer?.name||'Customer'} · Loan ${row.loanNumber||'reference unavailable'} has a scheduled reminder or payment promise.`,'/employee/follow-ups?loan='+id(row));if(row.missed)for(const admin of adminUsers)await put(admin,key,'Missed overdue follow-up',`${row.customer?.name||'Customer'} · Loan ${row.loanNumber||'reference unavailable'} has a missed follow-up or payment promise.`,'/admin/follow-ups?loan='+id(row));}
}
async function processEvents(){
 if(processing||mongoose.connection.readyState!==1)return;processing=true;
 try{
  await initialize();const active=await Dispatch.findById('activation');
  // Anti-join, not an ObjectId cursor: a transaction committed out of order must still be delivered.
  const smart=await Dispatch.findById('smart-v1');
  const events=await Audit.aggregate([{$match:{createdAt:{$gte:active.startedAt},action:{$in:[/^KYC_(SUBMITTED|APPROVED|REJECTED|CORRECTION_REQUIRED)$/,/^CUSTOMER_REQUEST_(SUBMITTED|APPROVED|REJECTED)$/,'OVERDUE_FOLLOW_UP_RECORDED','CUSTOMER_REASSIGNED','LOAN_ISSUED','LOAN_STATUS_CHANGED','PAYMENT_RECEIVED','CUSTOMER_PAYMENT_VERIFIED',/^SETTLEMENT_(SUBMITTED|VERIFIED|REJECTED|DISPUTED|REVERSED)$/,/^ACCOUNT_REQUEST_(SUBMITTED|APPROVED|REJECTED)$/]}}},{$match:{$or:[{action:{$ne:'CUSTOMER_REASSIGNED'}},{createdAt:{$gte:smart.startedAt}}]}},{$sort:{createdAt:1,_id:1}},{$lookup:{from:Dispatch.collection.name,let:{key:{$concat:['audit:',{$toString:'$_id'}]}},pipeline:[{$match:{$expr:{$eq:['$_id','$$key']}}}],as:'delivery'}},{$match:{delivery:{$size:0}}},{$limit:100}]);
  for(const event of events){await dispatch(event);await Dispatch.updateOne({_id:'audit:'+id(event)},{$setOnInsert:{completedAt:new Date()}},{upsert:true});}
  if(Date.now()-lastDue>60000){await dueAlerts();await followUpAlerts();lastDue=Date.now();}
 }finally{processing=false;}
}
function start(){if(timer)return;processEvents().catch(()=>console.error('Notification dispatcher unavailable; retrying'));timer=setInterval(()=>processEvents().catch(()=>console.error('Notification dispatcher unavailable; retrying')),2000);timer.unref();}
function stop(){clearInterval(timer);timer=undefined;lastDue=0;}
async function list(user,query={}){
 const page=Math.max(1,Math.min(10000,Math.trunc(Number(query.page))||1)),limit=Math.max(1,Math.min(50,Math.trunc(Number(query.limit))||20)),where={...scope(user),dismissedAt:null,...(query.unread==='true'?{readAt:null}:{})},filter=require('./notificationTarget.service').filter(query.category);if(filter)where.$and=[filter];
 const group=query.group||'ALL';if(!['ALL','PAYMENTS','LOANS','SYSTEM'].includes(group))throw Object.assign(new Error('Choose a valid notification group'),{status:422});
 if(group!=='ALL')where.$and=[...(where.$and||[]),{$expr:{$eq:[require('../utils/notificationGroups').expression,group]}}];
 const find=query.search?require('./notificationSearch.service')(where,query.search,page,limit,user):Promise.all([Inbox.find(where).sort({createdAt:-1,_id:-1}).skip((page-1)*limit).limit(limit).select('-recipientId -role').lean(),Inbox.countDocuments(where)]).then(([rows,total])=>({rows,total}));
 const [{rows,total},unread,groupRows]=await Promise.all([find,Inbox.countDocuments({...scope(user),dismissedAt:null,readAt:null}),Inbox.aggregate([{$match:{...scope(user),recipientId:new mongoose.Types.ObjectId(user.id),dismissedAt:null}},{$group:{_id:require('../utils/notificationGroups').expression,count:{$sum:1}}}])]);const groups={ALL:0,PAYMENTS:0,LOANS:0,SYSTEM:0};for(const row of groupRows){groups[row._id]=row.count;groups.ALL+=row.count;}return {groups,rows:(await require('./paymentNotification.service').enrich(rows,user)).map(row=>({...row,category:require('./notificationTarget.service').category(row)})),total,unread,page,limit,totalPages:Math.ceil(total/limit)};
}

async function mark(user,idValue,unread){
 if(typeof unread!=='boolean')throw Object.assign(new Error('Specify read or unread status'),{status:422});
 if(!mongoose.isValidObjectId(idValue))throw Object.assign(new Error('Notification not found'),{status:404});
 const exists=await Inbox.exists({...scope(user),dismissedAt:null,_id:idValue});if(!exists)throw Object.assign(new Error('Notification not found'),{status:404});
 const row=await Inbox.findOneAndUpdate({...scope(user),dismissedAt:null,_id:idValue,...(unread?{}:{readAt:null})},{$set:{readAt:unread?null:new Date()}},{returnDocument:'after'});if(!row&&unread)throw Object.assign(new Error('Notification not found'),{status:404});return {updated:true};
}
async function dismiss(user,notificationId,restore=false){
 await require('./settlement.service').authorize(user);
 if(!mongoose.isValidObjectId(notificationId))throw Object.assign(new Error('Notification not found'),{status:404});
 const row=await Inbox.findOneAndUpdate({...scope(user),_id:notificationId},{$set:{dismissedAt:restore?null:new Date()}},{returnDocument:'after'}).select('_id');
 if(!row)throw Object.assign(new Error('Notification not found'),{status:404});
 return {updated:true,dismissed:!restore};
}
async function open(user,notificationId,target='receipt'){
 await require('./settlement.service').authorize(user);
 if(!mongoose.isValidObjectId(notificationId))throw Object.assign(new Error('Notification not found'),{status:404});
 if(!['receipt','employee','customer','loan'].includes(target))throw Object.assign(new Error('Choose a valid notification action'),{status:422});
 const row=await Inbox.findOne({...scope(user),dismissedAt:null,_id:notificationId}).lean();if(!row)throw Object.assign(new Error('Notification not found'),{status:404});
 const [resolved]=await require('./paymentNotification.service').enrich([row],user),context=resolved.paymentContext;
 if(!context){if(target!=='receipt')throw Object.assign(new Error('This action is unavailable for this notification'),{status:422});if(row.paymentId||resolved.paymentUnavailable)throw Object.assign(new Error('The original payment reference is unavailable. No other payment has been substituted.'),{status:404});const path=await require('./notificationTarget.service').resolve(row,user);await mark(user,notificationId,false);return {path};}
 let path;
 if(target==='receipt'){await require('./collection.service').getCollectionReceiptService(context.paymentId,user);path='/'+user.role.toLowerCase()+'/collections/receipt/'+context.paymentId;}
 else if(target==='loan'){if(!context.loan?.id)throw Object.assign(new Error('The referenced loan is unavailable'),{status:404});await require('./loan.service').getLoanByIdService(context.loan?.id,user);path='/'+user.role.toLowerCase()+'/loans/'+context.loan.id;}
 else {if(user.role!=='ADMIN')throw Object.assign(new Error('Only Admin may open employee or customer management from this notification'),{status:403});const entity=context[target];if(!entity)throw Object.assign(new Error('The referenced '+target+' is unavailable'),{status:404});path='/admin/'+(target==='employee'?'employees/':'customers/')+entity.id;}
 await mark(user,notificationId,false);return {path};
}
const connections=new Map();
async function stream(req,res){
 // Authentication awaits MongoDB; the browser may have cancelled before this handler runs.
 if(req.aborted||res.destroyed||res.writableEnded)return;
 const key=req.user.role+':'+req.user.id;
 if((connections.get(key)||0)>=5){res.status(429).json({success:false,message:'Too many live notification connections. Close an unused portal tab and retry.'});return;}
 connections.set(key,(connections.get(key)||0)+1);
 res.status(200).set({'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
 let busy=false,closed=false,last='';const token=req.headers.authorization.split(' ')[1];
 const poll=async()=>{if(busy||closed)return;busy=true;try{
  let decoded;
  try{decoded=require('../utils/jwt').verifyToken(token);}catch{if(!closed&&!res.writableEnded){res.write('event: revoked\ndata: {}\n\n');res.end();}return;}
  const Model=decoded.role==='ADMIN'?Admin:Employee;
  const actor=await Model.findById(decoded.id).select('status isActive +authVersion');
  if(closed||res.writableEnded)return;
  if(!actor||(decoded.role==='ADMIN'?!actor.isActive:actor.status!=='ACTIVE')||(actor.authVersion||0)!==(decoded.authVersion||0)){res.write('event: revoked\ndata: {}\n\n');return res.end();}
  const count=await Inbox.countDocuments(scope(req.user)),unread=await Inbox.countDocuments({...scope(req.user),dismissedAt:null,readAt:null}),recent=await Inbox.findOne(scope(req.user)).sort({updatedAt:-1}).select('updatedAt');const stamp=count+':'+unread+':'+(recent?.updatedAt?.toISOString()||'');
  if(closed||res.writableEnded)return;
  if(stamp!==last){last=stamp;res.write('event: inbox\ndata: {}\n\n');}else res.write(': heartbeat\n\n');
 }catch{if(!closed&&!res.writableEnded){res.write('event: retry\ndata: {}\n\n');res.end();}}finally{busy=false;}};
 const interval=setInterval(poll,2000);const close=()=>{if(closed)return;closed=true;clearInterval(interval);const count=(connections.get(key)||1)-1;if(count)connections.set(key,count);else connections.delete(key);};res.on('close',close);await poll();
}
module.exports={dismiss,open,initialize,processEvents,dueAlerts,followUpAlerts,start,stop,list,mark,stream,dispatch};
