const LoanTimeline=require('../models/LoanTimeline');
const createLoanTimelineEntry=(loanId,action,description)=>LoanTimeline.create({loanId,action,description});
const key=value=>String(value?._id||value);
const normalize=value=>String(value||'').trim().toUpperCase().replace(/[ -]+/g,'_');
const money=value=>Number(value).toLocaleString('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2});
const modes={CASH:'Cash',UPI:'UPI',BANK_TRANSFER:'Bank transfer',CHEQUE:'Cheque'};
function buildActivity(events,payments,reviews,loan,scheduleCount){
 const activity=events.filter(e=>!['PAYMENT_RECEIVED','PAYMENT_VERIFIED'].includes(normalize(e.action))).map(e=>{
  const type=normalize(e.action),base={...e,type};
  if(type==='LOAN_CREATED')return {...base,title:'Loan Created',description:`Loan ${loan.loanNumber} issued`,target:'LOAN'};
  if(['SCHEDULE_GENERATED','SCHEDULE_CREATED'].includes(type))return {...base,type:'SCHEDULE_GENERATED',title:'Installment Schedule Created',description:`${scheduleCount} installments in the saved schedule`,target:'SCHEDULE'};
  if(['PAYMENT_REVERSED','COLLECTION_REVERSED'].includes(type))return {...base,type:'PAYMENT_REVERSED',title:'Payment Reversed'};
  if(['LOAN_COMPLETED','COMPLETED'].includes(type))return {...base,type:'LOAN_COMPLETED',title:'Loan Completed'};
  return {...base,title:String(e.action).replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())};
 });
 const byId=new Map(payments.map(p=>[key(p),p]));
 for(const p of payments){if(!(p.amountReceived>0)||['MISSED','WAIVED'].includes(p.status))continue;
  activity.push({_id:'receipt:'+key(p),type:p.status==='REVERSED'?'PAYMENT_REVERSED':'PAYMENT_RECEIVED',title:`${money(p.amountReceived)} Payment ${p.status==='REVERSED'?'Reversed':'Received'}`,description:`${modes[p.paymentMode]||'Payment method not recorded'} · Receipt ${p.collectionNumber}`,date:p.paymentDate,recordedAt:p.createdAt,receiptId:p._id,collectionNumber:p.collectionNumber,target:'RECEIPT'});
 }
 for(const r of reviews){const p=byId.get(key(r.collectionId));if(!p||!(p.amountReceived>0)||['MISSED','WAIVED'].includes(p.status))continue;
  activity.push({_id:'review:'+key(r),type:'PAYMENT_VERIFIED',title:'Payment Verified',description:`Receipt ${p.collectionNumber} · Customer receipt review`,date:r.verifiedAt,receiptId:p._id,collectionNumber:p.collectionNumber,review:{verifiedBy:r.verifiedBy?.name||'Admin',verifiedAt:r.verifiedAt,remarks:r.remarks||''},target:'REVIEW'});
 }
 return activity.sort((a,b)=>(new Date(b.date).getTime()||0)-(new Date(a.date).getTime()||0)||key(b).localeCompare(key(a)));
}
async function getLoanTimeline(loanId,authorizedLoan){
 const Collection=require('../models/Collection'),Review=require('../models/CustomerPaymentReview');
 const [events,payments,loan,scheduleCount]=await Promise.all([LoanTimeline.find({loanId}).lean(),Collection.find({loanId}).select('collectionNumber amountReceived paymentMode paymentDate createdAt status').lean(),authorizedLoan||require('../models/Loan').findById(loanId).select('loanNumber').lean(),require('../models/LoanSchedule').countDocuments({loanId})]);
 const reviews=await Review.find({collectionId:{$in:payments.map(p=>p._id)}}).populate('verifiedBy','name').lean();
 return buildActivity(events,payments,reviews,loan||{},scheduleCount);
}
module.exports={createLoanTimelineEntry,getLoanTimeline,buildActivity};
