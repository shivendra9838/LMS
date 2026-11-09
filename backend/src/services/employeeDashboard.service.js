// Read-only dashboard: shared receipt-date coverage, exact allocation evidence,
// and current authorization/sequence remain distinct from historical display dates.
const mongoose=require('mongoose'),finance=require('./settlement.service');
const {calculate,validReceipt,activeAtDate}=require('./collectionPerformance.service');
const {businessDay,bounds,addDays}=require('../utils/businessDay');
const {legacyMinor,major}=require('../utils/money');
const {present}=require('../utils/installmentStatus');
const {sequenceState}=require('../utils/installmentSequence');
const id=v=>String(v?._id||v);
const searchText=value=>(value||'').trim().toLocaleLowerCase();
async function read(user,query={},options={}){
 await finance.authorize(user);if(user.role!=='EMPLOYEE')throw finance.error(403,'This dashboard is available to employees only');
 if(query.employeeId&&query.employeeId!==user.id)throw finance.error(403,'You can only view your own dashboard');
 const date=query.date||businessDay();bounds(date);const {page,limit,skip}=require('./customerPortfolio.service').pageInfo(query),filter=query.filter||'ALL';
 if(!['ALL','TODAY','PAID','OVERDUE'].includes(filter))throw finance.error(422,'Choose a supported installment filter');
 if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>100))throw finance.error(422,'Search is limited to 100 characters');
 if(query.loanId&&!/^[a-f0-9]{24}$/i.test(query.loanId))throw finance.error(422,'Use a valid loan identifier');
 const Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Collection=require('../models/Collection'),Customer=require('../models/Customer'),Employee=require('../models/Employee');
 const employeeId=new mongoose.Types.ObjectId(user.id);
 const loans=await Loan.find({employeeId,status:{$ne:'CANCELLED'}}).select('_id customerId loanNumber loanDate remainingAmount status').populate('customerId','name mobile customerCode employeeId').sort({createdAt:-1,_id:1}).lean();
 if(query.loanId&&!loans.some(l=>id(l)===query.loanId))throw finance.error(404,'Loan is unavailable or not assigned to you');
 const [schedules,receipts,activeCustomers,assignedRoster]=await Promise.all([
  Schedule.find({loanId:{$in:loans.map(l=>l._id)}}).select('_id loanId dayNumber date amount paidAmount paidDate status').sort({date:1,dayNumber:1,_id:1}).lean(),
  Collection.find({$or:[{employeeId},{loanId:{$in:loans.map(l=>l._id)}}]}).select('_id loanId loanScheduleId employeeId collectedBy recordedByRole collectionNumber amountReceived paymentMode paymentDate createdAt allocations status').lean(),
  Customer.countDocuments({employeeId,status:'ACTIVE'}),Customer.find({employeeId}).select('_id name mobile customerCode status').sort({name:1,_id:1}).lean()
 ]);
 const valid=receipts.filter(validReceipt),visibleReceipts=valid.filter(r=>businessDay(r.paymentDate)<=date),receivedOnDate=valid.filter(r=>id(r.employeeId)===user.id&&businessDay(r.paymentDate)===date);
 const advanceAllocatedOnDate=major(receivedOnDate.reduce((total,r)=>total+(r.allocations||[]).filter(a=>a.dueDate&&businessDay(a.dueDate)>date).reduce((sum,a)=>sum+legacyMinor(a.amount),0),0));
 const unmappedReceivedOnDate=major(receivedOnDate.reduce((total,r)=>total+Math.max(0,legacyMinor(r.amountReceived)-(r.allocations||[]).reduce((sum,a)=>sum+legacyMinor(a.amount),0)),0));
 const [employees,reviews]=await Promise.all([Employee.find({_id:{$in:visibleReceipts.filter(r=>r.recordedByRole!=='ADMIN').map(r=>r.collectedBy).filter(Boolean)}}).select('name employeeCode').lean(),require('../models/CustomerPaymentReview').find({collectionId:{$in:visibleReceipts.map(r=>r._id)}}).populate('verifiedBy','name').lean()]);
 const people=new Map(employees.map(e=>[id(e),e])),checked=new Map(reviews.map(r=>[id(r.collectionId),r]));
 const loanMap=new Map(loans.map(l=>[id(l),l])),scheduleMap=new Map(schedules.map(s=>[id(s),s])),next=new Map(),bySchedule=new Map(),primaryActual=new Map();
 for(const row of [...schedules].sort((a,b)=>a.dayNumber-b.dayNumber))if(legacyMinor(row.amount)>legacyMinor(row.paidAmount)&&!next.has(id(row.loanId)))next.set(id(row.loanId),row);
 for(const receipt of visibleReceipts){
  const allocations=(receipt.allocations||[]).filter(a=>{const row=scheduleMap.get(id(a.scheduleId));return row&&id(row.loanId)===id(receipt.loanId)&&a.amount>0;}).map(a=>({...a,dayNumber:scheduleMap.get(id(a.scheduleId)).dayNumber}));
  const primary=allocations.some(a=>id(a.scheduleId)===id(receipt.loanScheduleId))?id(receipt.loanScheduleId):allocations[0]?id(allocations[0].scheduleId):id(receipt.loanScheduleId);
  if(businessDay(receipt.paymentDate)===date&&id(receipt.employeeId)===user.id&&scheduleMap.has(primary))primaryActual.set(primary,(primaryActual.get(primary)||0)+legacyMinor(receipt.amountReceived));
  for(const a of allocations){const key=id(a.scheduleId);if(!bySchedule.has(key))bySchedule.set(key,[]);const otherAllocations=allocations.filter(other=>id(other.scheduleId)!==key),review=checked.get(id(receipt)),collector=people.get(id(receipt.collectedBy));
   bySchedule.get(key).push({_id:receipt._id,collectionNumber:receipt.collectionNumber,amount:receipt.amountReceived,allocatedAmount:a.amount,paymentDate:receipt.paymentDate,recordedAt:receipt.createdAt,mode:receipt.paymentMode,collectedByName:receipt.recordedByRole==='ADMIN'?'Admin':collector?.name||'Not recorded',otherAllocations,advanceCarriedForward:major(otherAllocations.filter(other=>other.dayNumber>a.dayNumber).reduce((sum,other)=>sum+legacyMinor(other.amount),0)),unallocatedAmount:major(legacyMinor(receipt.amountReceived)-(receipt.allocations||[]).reduce((sum,other)=>sum+legacyMinor(other.amount),0)),primary:primary===key,review:review?{verifiedAt:review.verifiedAt,verifiedBy:review.verifiedBy?.name||'Admin',remarks:review.remarks}:null});
  }
 }
 const active=activeAtDate(loans,schedules,receipts,date),projected=calculate(schedules,receipts,date,user.id,true),{rows:raw,...allTotals}=projected;
 const totals=calculate(schedules.filter(s=>active.has(id(s.loanId))),receipts,date,user.id,true);delete totals.rows;
 const rows=raw.map(row=>{const loan=loanMap.get(id(row.loanId)),current=scheduleMap.get(id(row));
  const currentSchedule={...present({...current,dueDate:current.date,loanStatus:loan.status,loanRemainingAmount:loan.remainingAmount}),loanIssueDate:loan.loanDate,loanNumber:loan.loanNumber,customerName:loan.customerId?.name||'Unavailable customer',...sequenceState({...current,loanStatus:loan.status,loanRemainingAmount:loan.remainingAmount},next.get(id(loan)))};
  if(row.requiresHistoryReview)currentSchedule.canCollect=false;
  const receiptSummaries=bySchedule.get(id(row))||[];
  return {...row,customerName:currentSchedule.customerName,customerCode:loan.customerId?.customerCode,loanNumber:loan.loanNumber,customerId:loan.customerId?._id,canViewCustomer:id(loan.customerId?.employeeId)===user.id,hasPaymentHistory:receiptSummaries.length>0,receiptSummaries,actualReceived:major(primaryActual.get(id(row))||0),activeAtDate:active.has(id(row.loanId)),currentSchedule};
 });
 const customers=require('../utils/customerCollectionSummary').summarize(assignedRoster,rows,date,searchText(query.search));
 const customerCounts={ALL:customers.length,TODAY:customers.filter(c=>c.matchesToday).length,PAID:customers.filter(c=>c.status==='Paid').length,OVERDUE:customers.filter(c=>c.previousOverdue>0).length};
 const customerFiltered=customers.filter(c=>filter==='ALL'||filter==='TODAY'&&c.matchesToday||filter==='PAID'&&c.status==='Paid'||filter==='OVERDUE'&&c.previousOverdue>0);
 const due=rows.filter(r=>r.activeAtDate&&businessDay(r.date)===date),dueCustomers=new Set(due.map(r=>id(r.customerId))),overdueCustomers=new Set(rows.filter(r=>r.activeAtDate&&r.remaining>0&&businessDay(r.date)<date).map(r=>id(r.customerId)));
 const search=(query.search||'').trim().toLocaleLowerCase(),searched=rows.filter(r=>{const c=loanMap.get(id(r.loanId)).customerId;return !search||[r.customerName,r.customerCode,r.loanNumber,c?.mobile].some(v=>String(v||'').toLocaleLowerCase().includes(search));});
 const counts={ALL:searched.length,TODAY:searched.filter(r=>r.activeAtDate&&businessDay(r.date)===date).length,PAID:searched.filter(r=>!r.remaining).length,OVERDUE:searched.filter(r=>r.activeAtDate&&r.remaining>0&&businessDay(r.date)<date).length};
 const filtered=searched.filter(r=>filter==='ALL'||filter==='TODAY'&&r.activeAtDate&&businessDay(r.date)===date||filter==='PAID'&&!r.remaining||filter==='OVERDUE'&&r.activeAtDate&&r.remaining>0&&businessDay(r.date)<date);
 const selectedLoan=query.loanId||id(rows.find(r=>r.currentSchedule.canCollect)?.loanId||rows.find(r=>r.activeAtDate&&r.remaining)?.loanId||loans[0]?._id||'');
 const trend=Array.from({length:7},(_,index)=>({date:addDays(date,index-6),amount:0})),daily=new Map(trend.map(r=>[r.date,0]));
 for(const receipt of valid)if(id(receipt.employeeId)===user.id&&daily.has(businessDay(receipt.paymentDate)))daily.set(businessDay(receipt.paymentDate),daily.get(businessDay(receipt.paymentDate))+legacyMinor(receipt.amountReceived));
 return {...(options.includeCustomerSummaries?{customerSummaries:customers}:{}),date,timeZone:'Asia/Kolkata',...totals,advanceAllocatedOnDate,unmappedReceivedOnDate,unattributedHistoricalAmount:allTotals.unattributedHistoricalAmount,dueCount:due.length,dueCustomerCount:dueCustomers.size,overdueCustomerCount:overdueCustomers.size,activeCustomers,assignedCustomers:assignedRoster.length,customerRows:customerFiltered.slice(skip,skip+limit),customerCounts,customerMeta:{page,limit,total:customerFiltered.length,totalPages:Math.ceil(customerFiltered.length/limit)},customerCount:new Set(searched.map(r=>id(r.customerId))).size,counts,
  loans:loans.map(l=>({_id:l._id,loanNumber:l.loanNumber,customerName:l.customerId?.name||'Unavailable customer'})),selectedLoan,timeline:rows.filter(r=>id(r.loanId)===selectedLoan).sort((a,b)=>a.dayNumber-b.dayNumber),trend:trend.map(r=>({...r,amount:major(daily.get(r.date))})),rows:filtered.slice(skip,skip+limit),recoveryBreakdown:rows.filter(r=>r.activeAtDate&&businessDay(r.date)<=date&&(r.remaining>0||r.receiptSummaries.some(p=>businessDay(p.paymentDate)===date))).map(r=>({_id:r._id,customerName:r.customerName,loanNumber:r.loanNumber,dayNumber:r.dayNumber,dueDate:r.dueDate,amount:r.amount,coveredBeforeDate:r.coveredBeforeDate,allocatedOnDate:r.allocatedOnDate,legacyCoverage:r.legacyCoverage,paidAmount:r.paidAmount,remaining:r.remaining})),breakdown:due.map(r=>({_id:r._id,customerName:r.customerName,loanNumber:r.loanNumber,dayNumber:r.dayNumber,dueDate:r.dueDate,amount:r.amount,coveredBeforeDate:r.coveredBeforeDate,allocatedOnDate:r.allocatedOnDate,legacyCoverage:r.legacyCoverage,paidAmount:r.paidAmount,remaining:r.remaining})),reconciliationIssues:rows.filter(r=>r.requiresHistoryReview).length,meta:{page,limit,total:filtered.length,totalPages:Math.ceil(filtered.length/limit)}};
}
module.exports={read};
