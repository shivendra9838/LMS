const LoanSchedule = require('../models/LoanSchedule');
const mongoose = require('mongoose');
const {bounds} = require('../utils/businessDay');
const {present} = require('../utils/installmentStatus');
const {sequenceLookup,sequenceState}=require('../utils/installmentSequence');

async function getInstallments(employeeId, scope='DUE', loanId, pagination) {
  const {start,end} = bounds();
  const match = {};
  if(scope==='TODAY')match.date={$gte:start,$lt:end};
  if(scope==='UPCOMING')match.date={$gte:end};
  if(scope==='OVERDUE'||scope==='DUE'){
    match.date={$lt:scope==='DUE'?end:start};
    match.$expr={$gt:['$amount',{$ifNull:['$paidAmount',0]}]};
  }
  if(loanId)match.loanId=new mongoose.Types.ObjectId(loanId);
  if(pagination?.customerId)match.loanId={$in:await require('../models/Loan').distinct('_id',{customerId:pagination.customerId})};
  // Optional read-only directory filters; collection eligibility and allocation remain unchanged.
  if(pagination?.paidState==='PAID')match.$expr={$gte:[{$ifNull:['$paidAmount',0]},'$amount']};
  if(pagination?.paidState==='ADVANCE')match.paidAmount={$gt:0};
  if(pagination?.paymentState){const paid={$ifNull:['$paidAmount',0]};const state=pagination.paymentState;match.$and=[{ $expr:state==='PAID'?{$gte:[paid,'$amount']}:state==='PARTIAL'?{$and:[{$gt:[paid,0]},{$lt:[paid,'$amount']}]}:{$lte:[paid,0]} }];}
  const loanMatch={'loan.status':{$ne:'CANCELLED'}};
  if(employeeId)loanMatch['loan.employeeId']=new mongoose.Types.ObjectId(employeeId);
  if(['DUE','OVERDUE'].includes(scope)){
    loanMatch['loan.status']={$in:require('../services/overdue.service').OPEN_STATUSES};
    loanMatch['loan.remainingAmount']={$gt:0};
  }
  const pipeline=[
    {$match:match},
    {$lookup:{from:'loans',localField:'loanId',foreignField:'_id',as:'loan'}},{$unwind:'$loan'},{$match:loanMatch},
    {$lookup:{from:'customers',localField:'loan.customerId',foreignField:'_id',as:'customer'}},{$unwind:'$customer'},
    {$project:{_id:1,loanScheduleId:'$_id',loanId:'$loan._id',customerId:'$customer._id',customerName:'$customer.name',customerCode:'$customer.customerCode',customerMobile:'$customer.mobile',employeeId:'$loan.employeeId',loanNumber:'$loan.loanNumber',dayNumber:1,amount:1,paidAmount:1,paidDate:1,dueDate:'$date',status:1,loanIssueDate:'$loan.loanDate',loanRemainingAmount:'$loan.remainingAmount',loanStatus:'$loan.status'}},
    {$sort:{dueDate:1,customerName:1,_id:1}}
  ];
  if(pagination?.paidState==='ADVANCE'){
    const day=date=>({$dateToString:{date,format:'%Y-%m-%d',timezone:'Asia/Kolkata'}});
    // Retain early allocation evidence even after a later receipt completes the installment.
    pipeline.push({$lookup:{from:'collections',let:{schedule:'$_id',loan:'$loanId',due:'$dueDate'},pipeline:[
      {$match:{amountReceived:{$gt:0},status:{$in:['PAID','PARTIAL','EXTRA_PAYMENT']},paymentDate:{$type:'date',$lt:end},$expr:{$and:[
        {$eq:['$loanId','$$loan']},{$lt:[day('$paymentDate'),day('$$due')]},
        {$or:[{$gt:[{$size:{$filter:{input:{$ifNull:['$allocations',[]]},as:'entry',cond:{$and:[{$eq:['$$entry.scheduleId','$$schedule']},{$gt:['$$entry.amount',0]}]}}}},0]},{$and:[{$eq:[{$size:{$ifNull:['$allocations',[]]}},0]},{$eq:['$loanScheduleId','$$schedule']}]}]}
      ]}}},{$limit:1},{$project:{_id:1}}
    ],as:'advanceReceiptEvidence'}},{$match:{'advanceReceiptEvidence.0':{$exists:true}}},{$unset:'advanceReceiptEvidence'});
  }
  const decorate=row=>{const {nextUnpaid,...fields}=row;return {...present(fields),...sequenceState(fields,nextUnpaid?.[0])};};
  if(pagination){if(pagination.search){const literal=pagination.search.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');pipeline.push({$match:{$or:['customerName','customerCode','customerMobile','loanNumber'].map(field=>({[field]:{$regex:literal,$options:'i'}}))}});}const {mongoMinor,major}=require('../utils/money');const [result]=await LoanSchedule.aggregate([...pipeline,{$facet:{total:[{$count:'count'}],balance:[{$group:{_id:null,amountMinor:{$sum:mongoMinor('$amount')},paidMinor:{$sum:mongoMinor('$paidAmount')},remainingMinor:{$sum:{$max:[0,{$subtract:[mongoMinor('$amount'),mongoMinor('$paidAmount')]}]}}}}],rows:[{$skip:pagination.skip},{$limit:pagination.limit},sequenceLookup()]}}]);return {rows:result.rows.map(decorate),total:result.total[0]?.count||0,remainingAmount:major(result.balance[0]?.remainingMinor||0),summary:{amount:major(result.balance[0]?.amountMinor||0),paidAmount:major(result.balance[0]?.paidMinor||0),remainingAmount:major(result.balance[0]?.remainingMinor||0),total:result.total[0]?.count||0}};}
  return (await LoanSchedule.aggregate([...pipeline,sequenceLookup()])).map(decorate);
}
const getTodayCollectionsForEmployee = employeeId => getInstallments(employeeId,'DUE');
const getCollectionHistoryForLoan = async loanId => {
  const rows=await require('../models/Collection').find({loanId}).populate('loanScheduleId','dayNumber date').populate('collectedBy','name employeeCode').sort({createdAt:-1}).lean();
  const reviews=await require('../models/CustomerPaymentReview').find({collectionId:{$in:rows.map(row=>row._id)}}).populate('verifiedBy','name').lean();
  return rows.map(row=>({...row,review:reviews.find(review=>String(review.collectionId)===String(row._id))||null,recordedAt:row.createdAt,allocations:(row.allocations||[]).map(a=>({...a,paymentDate:row.paymentDate,timing:require('../utils/installmentStatus').timing(row.paymentDate,a.dueDate)}))}));
};
module.exports={getInstallments,getTodayCollectionsForEmployee,getCollectionHistoryForLoan};
