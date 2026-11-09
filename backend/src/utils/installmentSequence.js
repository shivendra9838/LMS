const Schedule=require('../models/LoanSchedule');
const {mongoMinor,legacyMinor,major}=require('./money');
const unpaidExpression=()=>({$gt:[mongoMinor('$amount'),mongoMinor('$paidAmount')]});
// The installment number defines the contractual sequence; filters and payment labels do not.
const earliestUnpaid=(loanId,session)=>Schedule.findOne({loanId,$expr:unpaidExpression()})
 .select('_id dayNumber amount paidAmount').sort({dayNumber:1}).session(session).lean();
async function assertSequence(schedule,session){
 const first=await earliestUnpaid(schedule.loanId?._id||schedule.loanId,session);
 if(!first)throw Object.assign(new Error('No unpaid installment remains. Reload the loan before recording a payment.'),{status:409});
 if(String(first._id)!==String(schedule._id)){
  const remaining=major(legacyMinor(first.amount)-legacyMinor(first.paidAmount));
  throw Object.assign(new Error(`Cannot collect Day ${schedule.dayNumber}. Day ${first.dayNumber} has ₹${remaining.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} remaining.`),{status:409});
 }
 return first;
}
const sequenceLookup=()=>({$lookup:{from:'loanschedules',let:{sequenceLoanId:'$loanId'},pipeline:[
 {$match:{$expr:{$and:[{$eq:['$loanId','$$sequenceLoanId']},unpaidExpression()]}}},
 {$sort:{dayNumber:1}},{$limit:1},{$project:{_id:1,dayNumber:1,amount:1,paidAmount:1}}
],as:'nextUnpaid'}});
function sequenceState(row,next){
 const unpaid=legacyMinor(row.amount)>legacyMinor(row.paidAmount);
 const eligible=require('../services/overdue.service').OPEN_STATUSES.includes(row.loanStatus)&&row.loanRemainingAmount>0&&unpaid;
 const locked=Boolean(eligible&&next&&String(next._id)!==String(row._id));
 const remaining=next?major(legacyMinor(next.amount)-legacyMinor(next.paidAmount)):null;
 return {canCollect:Boolean(eligible&&next&&String(next._id)===String(row._id)),collectionLocked:locked,
  nextCollectibleScheduleId:next?next._id:null,nextCollectibleDayNumber:next?.dayNumber??null,nextCollectibleRemainingAmount:remaining,
  collectionLockReason:locked?`Complete Day ${next.dayNumber} payment (₹${remaining.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})} remaining) before collecting Day ${row.dayNumber}.`:null};
}
module.exports={unpaidExpression,earliestUnpaid,assertSequence,sequenceLookup,sequenceState};
