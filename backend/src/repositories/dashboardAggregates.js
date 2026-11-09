// Read-only dashboard projection of the same stored balances and IST rules used by financialReportData.
// No schedule, receipt, custody or loan records are updated here.
const mongoose=require('mongoose'),Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Collection=require('../models/Collection');
const {bounds,businessDay,dayStart}=require('../utils/businessDay'),{mongoMinor,major}=require('../utils/money');
async function metrics(employeeId){
 const owner=employeeId?new mongoose.Types.ObjectId(String(employeeId)):null,{start,end}=bounds(),monthStart=dayStart(businessDay().slice(0,8)+'01');
 const loanMatch=owner?{employeeId:owner}:{};
 const today={$and:[{$gte:['$date',start]},{$lt:['$date',end]}]},remaining={$max:[0,{$subtract:['$amount',{$ifNull:['$paidAmount',0]}]}]},unpaid={$gt:[remaining,0]},past={$and:[{$lt:['$date',start]},unpaid]};
 const sumIf=(condition,expression=1)=>({$sum:{$cond:[condition,expression,0]}});
 const [loans,schedules,receipts]=await Promise.all([
  Loan.aggregate([{$match:loanMatch},{$group:{_id:null,totalLoans:{$sum:1},activeLoans:sumIf({$in:['$status',['ACTIVE','DEFAULTED']]}),completedLoans:sumIf({$and:[{$in:['$status',['COMPLETED','CLOSED']]},{$eq:['$remainingAmount',0]}]}),outstandingMinor:{$sum:mongoMinor('$remainingAmount')}}}]),
  Schedule.aggregate([{$match:{date:{$lt:end}}},{$lookup:{from:'loans',localField:'loanId',foreignField:'_id',pipeline:[{$match:{...loanMatch,status:{$in:['ACTIVE','DEFAULTED']}}},{$project:{_id:1}}],as:'loan'}},{$match:{'loan.0':{$exists:true}}},{$group:{_id:null,todaysDue:sumIf({$and:[today,unpaid]}),todaysPaid:sumIf({$and:[today,{$gt:[{$ifNull:['$paidAmount',0]},0]}]}),todaysPending:sumIf({$and:[today,unpaid,{$ne:['$status','MISSED']}]}),todaysMissed:sumIf({$and:[today,unpaid,{$eq:['$status','MISSED']}]}),todayExpectedMinor:sumIf(today,mongoMinor('$amount')),dueTodayMinor:sumIf(today,mongoMinor(remaining)),overdueMinor:sumIf(past,mongoMinor(remaining)),overdueInstallments:sumIf(past)}}]),
  Collection.aggregate([{$match:{amountReceived:{$gt:0},paymentDate:{$gte:monthStart,$lt:end}}},{$lookup:{from:'loans',localField:'loanId',foreignField:'_id',pipeline:[{$match:loanMatch},{$project:{_id:1}}],as:'loan'}},{$match:{'loan.0':{$exists:true}}},{$group:{_id:null,todayCount:sumIf({$gte:['$paymentDate',start]}),todayMinor:sumIf({$gte:['$paymentDate',start]},mongoMinor('$amountReceived')),monthMinor:{$sum:mongoMinor('$amountReceived')}}}])
 ]);
 const loan=loans[0]||{},schedule=schedules[0]||{},receipt=receipts[0]||{},todayRevenue=major(receipt.todayMinor||0),expected=major(schedule.todayExpectedMinor||0);
 for(const group of [loan,schedule,receipt])for(const [key,value]of Object.entries(group))if(key.endsWith('Minor')&&!Number.isSafeInteger(value))throw Object.assign(new Error('Report exceeds safe monetary limits; narrow the filters'),{status:422});
 return {totalLoans:loan.totalLoans||0,activeLoans:loan.activeLoans||0,completedLoans:loan.completedLoans||0,totalOutstanding:major(loan.outstandingMinor||0),todaysCollection:receipt.todayCount||0,todaysRevenue:todayRevenue,monthlyRevenue:major(receipt.monthMinor||0),averageCollection:receipt.todayCount?todayRevenue/receipt.todayCount:0,collectionEfficiency:expected?todayRevenue/expected*100:0,todayExpectedAmount:expected,todaysDue:schedule.todaysDue||0,todaysPaid:schedule.todaysPaid||0,todaysPending:schedule.todaysPending||0,todaysMissed:schedule.todaysMissed||0,overdueAmount:major(schedule.overdueMinor||0),overdueInstallments:schedule.overdueInstallments||0,dueTodayAmount:major(schedule.dueTodayMinor||0)};
}
module.exports={metrics};
