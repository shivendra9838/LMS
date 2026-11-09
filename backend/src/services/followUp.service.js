const mongoose=require('mongoose'),crypto=require('crypto');
const FollowUp=require('../models/OverdueFollowUp'),Loan=require('../models/Loan'),Audit=require('../models/AuditLog');
const finance=require('./settlement.service');
const {businessDay,dayStart}=require('../utils/businessDay');
const {major,minor}=require('../utils/money');
const {OPEN_STATUSES,overdueAggregation,loanSummary}=require('./overdue.service');
const statuses=['PROMISED_TO_PAY','NO_RESPONSE','WILL_PAY_LATER','PAYMENT_DISPUTE'];
const id=v=>String(v?._id||v);
function objectId(value){if(typeof value!=='string'||!/^[a-f0-9]{24}$/i.test(value))throw finance.error(422,'Invalid loan or employee identifier');return new mongoose.Types.ObjectId(value);}
function reminderState(latest,today=businessDay()){
 if(!latest)return {pending:false,missed:false,reminderDueDate:null};
 const dates=[latest.nextReminderDate,latest.promisedDate].filter(Boolean).map(businessDay).sort(),date=dates[0];return {pending:date<=today,missed:date<today,reminderDueDate:date};
}
async function overdueCases(employeeId){
 const schedule=overdueAggregation();schedule[schedule.length-1].$group.oldestDate={$min:'$date'};
 const rows=await Loan.aggregate([
 {$match:{status:{$in:OPEN_STATUSES},remainingAmount:{$gt:0},...(employeeId?{employeeId:objectId(employeeId)}:{})}},
 {$lookup:{from:'loanschedules',let:{loanId:'$_id'},pipeline:schedule,as:'arrears'}},{$unwind:'$arrears'},
 {$lookup:{from:'customers',localField:'customerId',foreignField:'_id',pipeline:[{$project:{name:1,mobile:1,customerCode:1}}],as:'customer'}},
 {$lookup:{from:'employees',localField:'employeeId',foreignField:'_id',pipeline:[{$project:{name:1,employeeCode:1}}],as:'employee'}},
 {$lookup:{from:FollowUp.collection.name,let:{loanId:'$_id'},pipeline:[{$match:{$expr:{$eq:['$loanId','$$loanId']}}},{$sort:{followUpDate:-1,createdAt:-1,_id:-1}},{$limit:1},{$project:{requestHash:0,idempotencyKey:0}}],as:'followUp'}},
 {$project:{loanNumber:1,employeeId:1,customerId:1,customer:{$arrayElemAt:['$customer',0]},employee:{$arrayElemAt:['$employee',0]},latest:{$arrayElemAt:['$followUp',0]},amountMinor:'$arrears.amountMinor',missedInstallments:'$arrears.installments',oldestDue:'$arrears.oldestDate'}}
 ]);
 const authors=await Promise.all(['Admin','Employee'].map(model=>require('../models/'+model).find({_id:{$in:rows.filter(r=>r.latest?.authorModel===model).map(r=>r.latest.authorId)}}).select('name').lean()));const authorNames=new Map(authors.flatMap((items,index)=>items.map(a=>[(index===0?'Admin':'Employee')+':'+id(a),a.name])));
 const today=businessDay();return rows.map(r=>({...r,latest:r.latest?{...r.latest,authorName:authorNames.get(r.latest.authorModel+':'+id(r.latest.authorId))||'Unavailable user'}:undefined,overdueAmount:major(r.amountMinor),overdueDays:Math.max(1,Math.round((dayStart(today)-dayStart(businessDay(r.oldestDue)))/86400000)),...reminderState(r.latest,today)}));
}
async function authorizeLoan(loanId,user,session){
 await finance.authorize(user);const loan=await Loan.findById(objectId(loanId)).session(session||null);if(!loan)throw finance.error(404,'Loan not found');if(user.role==='EMPLOYEE'&&id(loan.employeeId)!==user.id)throw finance.error(403,'You can only follow up your assigned loans');return loan;
}
async function list(user,query={}){
 await finance.authorize(user);if(query.employeeId)objectId(query.employeeId);if(user.role==='EMPLOYEE'&&query.employeeId&&query.employeeId!==user.id)throw finance.error(403,'You can only view your assigned overdue loans');
 const {page,limit}=require('./customerPortfolio.service').pageInfo(query);
 const numeric=(key,max)=>{if(query[key]===undefined||query[key]==='')return null;const n=Number(query[key]);if(!Number.isFinite(n)||n<0||n>max||!Number.isInteger(n))throw finance.error(422,'Enter a valid overdue days or amount filter');return n;};
 const minDays=numeric('minDays',100000),maxDays=numeric('maxDays',100000),minAmount=query.minAmount?minor(query.minAmount,true):null,maxAmount=query.maxAmount?minor(query.maxAmount,true):null;
 if((minDays!==null&&maxDays!==null&&minDays>maxDays)||(minAmount!==null&&maxAmount!==null&&minAmount>maxAmount))throw finance.error(422,'Maximum filter must be at least the minimum');
 if(query.status&&!['NOT_CONTACTED','PENDING','MISSED',...statuses].includes(query.status))throw finance.error(422,'Choose a valid follow-up status');
 if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>100))throw finance.error(422,'Search is limited to 100 characters');
 let rows=await overdueCases(user.role==='EMPLOYEE'?user.id:undefined);const options=[...new Map(rows.map(r=>[id(r.employeeId),{_id:r.employeeId,name:r.employee?.name||'Unavailable employee',employeeCode:r.employee?.employeeCode}])).values()];
 rows=rows.filter(r=>(!query.employeeId||id(r.employeeId)===query.employeeId)&&(minDays===null||r.overdueDays>=minDays)&&(maxDays===null||r.overdueDays<=maxDays)&&(minAmount===null||r.amountMinor>=minAmount)&&(maxAmount===null||r.amountMinor<=maxAmount)&&(!query.status||(query.status==='NOT_CONTACTED'?!r.latest:query.status==='PENDING'?r.pending:query.status==='MISSED'?r.missed:r.latest?.status===query.status))&&(!query.search||[r.customer?.name,r.customer?.mobile,r.customer?.customerCode,r.loanNumber].filter(Boolean).join(' ').toLowerCase().includes(query.search.toLowerCase())));
 const sorts={days:(a,b)=>b.overdueDays-a.overdueDays,amount:(a,b)=>b.amountMinor-a.amountMinor,oldest:(a,b)=>new Date(a.oldestDue)-new Date(b.oldestDue),name:(a,b)=>String(a.customer?.name||'').localeCompare(String(b.customer?.name||''),'en-IN',{sensitivity:'base'})};
 const sort=query.sort||'days';if(!Object.hasOwn(sorts,sort))throw finance.error(422,'Choose a valid follow-up sort order');
 rows.sort((a,b)=>sorts[sort](a,b)||id(a).localeCompare(id(b)));
 const summary={loans:rows.length,overdueAmount:major(rows.reduce((n,r)=>n+r.amountMinor,0)),contacted:rows.filter(r=>r.latest).length,pending:rows.filter(r=>r.pending).length,missed:rows.filter(r=>r.missed).length,promises:rows.filter(r=>r.latest?.promisedDate).length};
 const employees=options.map(e=>{const assigned=rows.filter(r=>id(r.employeeId)===id(e));return {...e,overdueLoans:assigned.length,overdueAmount:major(assigned.reduce((n,r)=>n+r.amountMinor,0)),contacted:assigned.filter(r=>r.latest).length,pending:assigned.filter(r=>r.pending).length,missed:assigned.filter(r=>r.missed).length};}).filter(e=>e.overdueLoans);
 return {rows:rows.slice((page-1)*limit,page*limit),summary,employees,employeeOptions:options,meta:{page,limit,total:rows.length,totalPages:Math.ceil(rows.length/limit)}};
}
async function history(loanId,user,query={}){
 const loan=await authorizeLoan(loanId,user),{page,limit}=require('./customerPortfolio.service').pageInfo(query);
 const [rows,total,summary]=await Promise.all([FollowUp.find({loanId:loan._id}).select('-requestHash -idempotencyKey').populate('authorId','name employeeCode').sort({followUpDate:-1,createdAt:-1,_id:-1}).skip((page-1)*limit).limit(limit).lean(),FollowUp.countDocuments({loanId:loan._id}),loanSummary(loan)]);
 return {rows,loanNumber:loan.loanNumber,overdueAmount:summary.overdueAmount,meta:{page,limit,total,totalPages:Math.ceil(total/limit)}};
}
async function create(loanId,body,user){
 await authorizeLoan(loanId,user);if(!statuses.includes(body.status))throw finance.error(422,'Choose a follow-up outcome');
 if(typeof body.remarks!=='string'||!body.remarks.trim()||body.remarks.length>2000)throw finance.error(422,'Enter follow-up remarks (1–2000 characters)');
 const today=businessDay(),date=body.followUpDate,next=body.nextReminderDate;if(typeof date!=='string'||typeof next!=='string')throw finance.error(422,'Enter contact and next reminder dates');dayStart(date);dayStart(next);
 if(date>today||next<date)throw finance.error(422,'Contact date cannot be future-dated; reminder cannot precede contact');
 const promised=body.promisedDate||null;if(promised){dayStart(promised);if(promised<date)throw finance.error(422,'Promised payment cannot precede contact');}
 if((['PROMISED_TO_PAY','WILL_PAY_LATER'].includes(body.status)||body.reason==='PROMISED_ANOTHER_DATE')&&!promised)throw finance.error(422,'Enter the promised payment date');
 const reasonFields={};if(body.reason){if(!['CUSTOMER_UNAVAILABLE','INSUFFICIENT_FUNDS','BUSINESS_CLOSED','PROMISED_ANOTHER_DATE','CUSTOMER_REFUSED','OTHER'].includes(body.reason))throw finance.error(422,'Choose a valid missed-payment reason');dayStart(body.originalDueDate);if(body.originalDueDate>=date||!await require('../models/LoanSchedule').exists({loanId,date:dayStart(body.originalDueDate)}))throw finance.error(422,'Choose an original overdue installment date belonging to this loan');reasonFields.reason=body.reason;reasonFields.originalDueDate=dayStart(body.originalDueDate);}
 const key=finance.key(body.idempotencyKey),clean={...reasonFields,loanId,status:body.status,remarks:body.remarks.trim(),followUpDate:date,nextReminderDate:next,promisedDate:promised},requestHash=crypto.createHash('sha256').update(JSON.stringify(clean)).digest('hex');
 await Promise.all([FollowUp.init(),Audit.init()]);
 try{return await mongoose.connection.transaction(async session=>{
 const loan=await authorizeLoan(loanId,user,session),existing=await FollowUp.findOne({authorId:user.id,idempotencyKey:key}).select('+requestHash').session(session);if(existing){if(existing.requestHash!==requestHash)throw finance.error(409,'This follow-up request key was used for different details');return {_id:existing._id,saved:true};}
 const rows=await require('../models/LoanSchedule').find({loanId:loan._id}).session(session).lean();if(!OPEN_STATUSES.includes(loan.status)||loan.remainingAmount<=0||require('./overdue.service').scheduleSummary(loan,rows).overdueAmount<=0)throw finance.error(409,'This loan has no unpaid overdue installments. Refresh the list.');
 const [note]=await FollowUp.create([{...clean,loanId:loan._id,customerId:loan.customerId,assignedEmployeeId:loan.employeeId,authorId:user.id,authorRole:user.role,authorModel:user.role==='ADMIN'?'Admin':'Employee',followUpDate:dayStart(date),nextReminderDate:dayStart(next),promisedDate:promised?dayStart(promised):undefined,idempotencyKey:key,requestHash}],{session});
 await Audit.create([{userId:user.id,userRole:user.role,userModel:note.authorModel,action:'OVERDUE_FOLLOW_UP_RECORDED',module:'FOLLOW_UP',referenceId:id(note),newValue:{loanId:loan._id,status:note.status,nextReminderDate:note.nextReminderDate}}],{session});return {_id:note._id,saved:true};
 });}catch(error){if(error.code===11000){const existing=await FollowUp.findOne({authorId:user.id,idempotencyKey:key}).select('+requestHash');if(existing?.requestHash===requestHash)return {_id:existing._id,saved:true};throw finance.error(409,'Duplicate follow-up request. Reload the history.');}throw error;}
}
module.exports={list,history,create,overdueCases,reminderState,statuses};
