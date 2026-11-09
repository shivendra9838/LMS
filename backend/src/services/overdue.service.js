const Schedule=require('../models/LoanSchedule');
const {bounds}=require('../utils/businessDay');
const {legacyMinor,major}=require('../utils/money');
const OPEN_STATUSES=['ACTIVE','DEFAULTED'];
function scheduleSummary(loan,schedules,now=new Date()) {
  const {start,end}=bounds(require('../utils/businessDay').businessDay(now));
  const open=OPEN_STATUSES.includes(loan.status);const unpaid=schedules.filter(s=>legacyMinor(s.amount)>legacyMinor(s.paidAmount));
  const overdue=unpaid.filter(s=>new Date(s.date)<start);const today=unpaid.filter(s=>new Date(s.date)>=start&&new Date(s.date)<end);
  const scheduleTotal=schedules.reduce((n,s)=>n+legacyMinor(s.amount),0),schedulePaid=schedules.reduce((n,s)=>n+legacyMinor(s.paidAmount),0);
  return {overdueAmount:major(overdue.reduce((n,s)=>n+legacyMinor(s.amount)-legacyMinor(s.paidAmount),0)),overdueInstallments:overdue.length,dueTodayAmount:major(today.reduce((n,s)=>n+legacyMinor(s.amount)-legacyMinor(s.paidAmount),0)),effectiveStatus:open&&overdue.length?'OVERDUE':loan.status,canCollect:open&&loan.remainingAmount>0,financialReviewRequired:scheduleTotal!==legacyMinor(loan.totalPayable)||schedulePaid!==legacyMinor(loan.paidAmount)||legacyMinor(loan.totalPayable)-legacyMinor(loan.paidAmount)!==legacyMinor(loan.remainingAmount)};
}
async function loanSummary(loan) {return scheduleSummary(loan,await Schedule.find({loanId:loan._id}).lean());}
// Shared read-only aggregation form of the same unpaid, past-India-day schedule rule.
function overdueAggregation(loanVariable='$$loanId') {
  const {mongoMinor}=require('../utils/money');
  return [{$match:{date:{$lt:bounds().start},$expr:{$and:[{$eq:['$loanId',loanVariable]},{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}]}}},{$group:{_id:null,amountMinor:{$sum:{$subtract:[mongoMinor('$amount'),mongoMinor('$paidAmount')]}},installments:{$sum:1}}}];
}
module.exports={OPEN_STATUSES,scheduleSummary,loanSummary,overdueAggregation};
