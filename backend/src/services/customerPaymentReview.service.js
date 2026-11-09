const mongoose=require('mongoose');
const Collection=require('../models/Collection'),Review=require('../models/CustomerPaymentReview'),Schedule=require('../models/LoanSchedule'),Audit=require('../models/AuditLog');
const finance=require('./settlement.service');
const {legacyMinor,major}=require('../utils/money');
const id=value=>String(value?._id||value);
const eligible=row=>row.recordedByRole==='EMPLOYEE'&&id(row.collectedBy)===id(row.employeeId)&&require('./collectionPerformance.service').validReceipt(row);
function identifier(value){if(typeof value!=='string'||!/^[a-f0-9]{24}$/i.test(value))throw finance.error(422,'Invalid payment or installment identifier');return value;}
async function receipts(rows){
 const ids=rows.map(r=>r._id);if(!ids.length)return [];
 return Collection.find({amountReceived:{$gt:0},status:{$in:['PAID','PARTIAL','EXTRA_PAYMENT']},$or:[{'allocations.scheduleId':{$in:ids}},{loanScheduleId:{$in:ids}}]}).select('collectionNumber loanId loanScheduleId employeeId collectedBy recordedByRole amountReceived paymentDate createdAt paymentMode allocations status').lean();
}
function allocation(receipt,row){if(id(receipt.loanId)!==id(row.loanId))return 0;const matches=(receipt.allocations||[]).filter(a=>id(a.scheduleId)===id(row));if(matches.length)return matches.reduce((sum,a)=>sum+legacyMinor(a.amount),0);return !receipt.allocations?.length&&id(receipt.loanScheduleId)===id(row)?Math.min(legacyMinor(receipt.amountReceived),legacyMinor(row.paidAmount)):0;}
async function contexts(payments){
 const schedules=await Schedule.find({_id:{$in:payments.flatMap(p=>(p.allocations||[]).map(a=>a.scheduleId))}}).select('dayNumber').lean();
 const days=new Map(schedules.map(s=>[id(s),s.dayNumber]));
 const employeeIds=payments.filter(p=>p.recordedByRole==='EMPLOYEE').map(p=>p.collectedBy);
 const employees=await require('../models/Employee').find({_id:{$in:employeeIds}}).select('name').lean();
 const names=new Map(employees.map(e=>[id(e),e.name]));
 return (p,row)=>{const allocations=(p.allocations||[]).map(a=>({dayNumber:days.get(id(a.scheduleId))??null,amount:a.amount,scheduleId:a.scheduleId,paidEarly:a.dueDate?require('../utils/installmentStatus').timing(p.paymentDate,a.dueDate)==='PAID_EARLY':false}));const total=p.allocations?.length?p.allocations.reduce((n,a)=>n+legacyMinor(a.amount),0):null;return {allocationTiming:require('../utils/installmentStatus').timing(p.paymentDate,row.date||row.dueDate),isPrimaryInstallment:id(p.loanScheduleId)===id(row),receiptTotal:p.amountReceived,totalAllocated:total===null?null:major(total),unallocatedAmount:total===null?null:major(legacyMinor(p.amountReceived)-total),collectedByName:names.get(id(p.collectedBy))||null,otherAllocations:allocations.filter(a=>id(a.scheduleId)!==id(row)).map(a=>({...a,carriedForward:a.dayNumber>row.dayNumber}))};};
}
async function decorate(rows){
 const payments=await receipts(rows),reviews=await Review.find({collectionId:{$in:payments.map(p=>p._id)}}).lean(),verified=new Set(reviews.map(r=>id(r.collectionId)));
 const context=await contexts(payments);
 return rows.map(row=>{const related=payments.filter(p=>allocation(p,row)>0),valid=related.filter(eligible),recorded=valid.reduce((n,p)=>n+allocation(p,row),0),checked=valid.filter(p=>verified.has(id(p))).reduce((n,p)=>n+allocation(p,row),0),unproven=related.some(p=>!eligible(p))||legacyMinor(row.paidAmount)>recorded;
 return {...row,receiptSummaries:related.map(p=>({_id:p._id,collectionNumber:p.collectionNumber,allocatedAmount:major(allocation(p,row)),...context(p,row)})),hasPaymentHistory:related.length>0,paymentAllocationCount:related.length,allocatedPaidAmount:major(related.reduce((sum,p)=>sum+allocation(p,row),0)),customerPaymentReview:{status:unproven?'REQUIRES_HISTORY_REVIEW':!valid.length?'AWAITING_EMPLOYEE_COLLECTION':checked===recorded?'VERIFIED':'PENDING_REVIEW',recordedAmount:major(recorded),verifiedAmount:major(checked)}};});
}
async function installmentDetails(scheduleId,user,adminOnly){
 await finance.authorize(user,adminOnly);const row=await Schedule.findById(identifier(scheduleId)).lean();if(!row)throw finance.error(404,'Installment not found');
 const loan=await require('../models/Loan').findById(row.loanId).select('employeeId').lean();
 if(!loan)throw finance.error(404,'Loan not found');
 if(user.role==='EMPLOYEE'&&id(loan.employeeId)!==user.id)throw finance.error(403,'You can only view payment history for your assigned installments');
 const payments=(await receipts([row])).filter(p=>allocation(p,row)>0),reviews=await Review.find({collectionId:{$in:payments.map(p=>p._id)}}).populate('verifiedBy','name').lean();
 const context=await contexts(payments);
 return {dayNumber:row.dayNumber,installmentId:row._id,dueDate:row.date,amount:row.amount,paidAmount:row.paidAmount||0,statusLabel:require('../utils/installmentStatus').present(row).statusLabel,allocatedPaidAmount:major(payments.reduce((sum,p)=>sum+allocation(p,row),0)),remainingAmount:major(Math.max(0,legacyMinor(row.amount)-legacyMinor(row.paidAmount))),payments:payments.map(p=>({...context(p,row),_id:p._id,collectionNumber:p.collectionNumber,amount:p.amountReceived,allocatedAmount:major(allocation(p,row)),dueDate:row.date,paymentDate:p.paymentDate,recordedAt:p.createdAt,timing:require('../utils/installmentStatus').timing(p.paymentDate,row.date),mode:p.paymentMode,eligible:eligible(p),review:reviews.find(r=>id(r.collectionId)===id(p))||null}))};
}
const details=(scheduleId,user)=>installmentDetails(scheduleId,user,true);
const history=(scheduleId,user)=>installmentDetails(scheduleId,user,false);
async function verify(collectionId,user,body={}){
 if(body.remarks!==undefined&&(typeof body.remarks!=='string'||body.remarks.length>1000))throw finance.error(422,'Review remarks must be at most 1000 characters');
 await finance.authorize(user,true);identifier(collectionId);
 const payment=await Collection.findById(collectionId).lean();if(!payment)throw finance.error(404,'Employee payment record not found');
 if(!eligible(payment))throw finance.error(409,'Employee has not recorded this payment yet. Only an attributable employee receipt can be verified.');
 // Index creation precedes the transaction; no financial documents are written.
 await Review.init();
 try{return await mongoose.connection.transaction(async session=>{
 const existing=await Review.findOne({collectionId}).session(session);if(existing)return existing;
 const [review]=await Review.create([{collectionId,verifiedBy:user.id,verifiedAt:new Date(),remarks:body.remarks?.trim()||''}],{session});
 await Audit.create([{userId:user.id,userModel:'Admin',userRole:'ADMIN',action:'CUSTOMER_PAYMENT_VERIFIED',module:'CUSTOMER_PAYMENT',referenceId:collectionId,newValue:{reviewId:review._id,employeeId:payment.employeeId}}],{session});return review;
 });}catch(error){if(error.code===11000){const existing=await Review.findOne({collectionId});if(existing)return existing;}throw error;}
}
async function tracking(user,query={}){
 await finance.authorize(user);const {bounds,businessDay}=require('../utils/businessDay');const date=query.date||businessDay(),range=bounds(date);
 if(query.employeeId&&!/^[a-f0-9]{24}$/i.test(query.employeeId))throw finance.error(422,'Invalid employee identifier');
 if(user.role==='EMPLOYEE'&&query.employeeId&&query.employeeId!==user.id)throw finance.error(403,'You can only view your own payments');
 const employeeId=user.role==='EMPLOYEE'?user.id:query.employeeId,{page,limit}=require('./customerPortfolio.service').pageInfo(query),filter={...(employeeId?{employeeId}:{}),paymentDate:{$gte:range.start,$lt:range.end},amountReceived:{$gt:0},status:{$in:['PAID','PARTIAL','EXTRA_PAYMENT']}};
 const [rows,total]=await Promise.all([Collection.find(filter).sort({paymentDate:-1,_id:-1}).skip((page-1)*limit).limit(limit).select('customerId loanId employeeId collectionNumber amountReceived expectedAmount paymentDate createdAt paymentMode status recordedByRole collectedBy allocations').populate('customerId','name').populate('loanId','loanNumber').populate('employeeId','name employeeCode').lean(),Collection.countDocuments(filter)]);
 const reviews=await Review.find({collectionId:{$in:rows.map(r=>r._id)}}).populate('verifiedBy','name').lean();
 return {rows:rows.map(r=>{const review=reviews.find(v=>id(v.collectionId)===id(r));return {...r,eligible:eligible(r),review:review||null,paymentState:review?'VERIFIED':r.status==='PARTIAL'?'PARTIALLY_PAID':'RECORDED'};}),meta:{page,limit,total,totalPages:Math.ceil(total/limit)}};
}
module.exports={decorate,details,history,verify,tracking};
