const mongoose=require('mongoose');
const finance=require('./settlement.service');
const {businessDay,bounds}=require('../utils/businessDay');
const {legacyMinor,major}=require('../utils/money');
const id=v=>String(v?._id||v);
// Read-only projections. Receipt cash flow and coverage of due installments are different metrics.
const validReceipt=r=>Number.isFinite(Number(r.amountReceived))&&Number(r.amountReceived)>0&&['PAID','PARTIAL','EXTRA_PAYMENT'].includes(r.status)&&Number.isFinite(new Date(r.paymentDate).getTime())&&businessDay(r.paymentDate)<=businessDay();
function calculate(schedules,receipts,date,cashEmployeeId,includeUpcoming=false){
 const paid=new Map(),before=new Map(),onDate=new Map(),early=new Map(),allMapped=new Map(),invalidLinked=new Set(),scheduleMap=new Map(schedules.map(s=>[id(s),s])),seen=new Set();let actual=0;
 const add=(map,key,n)=>map.set(key,(map.get(key)||0)+n);
 for(const receipt of receipts){if(receipt._id&&seen.has(id(receipt)))continue;if(receipt._id)seen.add(id(receipt));const valid=validReceipt(receipt),day=valid?businessDay(receipt.paymentDate):null;
  if(valid&&day===date&&(!cashEmployeeId||id(receipt.employeeId)===id(cashEmployeeId)))actual+=legacyMinor(receipt.amountReceived);
  if(!valid&&receipt.amountReceived>0&&receipt.loanScheduleId)invalidLinked.add(id(receipt.loanScheduleId));
  for(const a of receipt.allocations||[]){const key=id(a.scheduleId),row=scheduleMap.get(key),n=legacyMinor(a.amount);if(!row||n<=0||receipt.loanId&&row.loanId&&id(receipt.loanId)!==id(row.loanId))continue;add(allMapped,key,n);
   if(!valid){invalidLinked.add(key);continue;}
   if(day<=date){add(paid,key,n);if(day<date)add(before,key,n);else add(onDate,key,n);if(day<businessDay(row.date))add(early,key,n);}
  }
 }
 let target=0,covered=0,overdue=0,unattributed=0,priorCoverage=0,dayCoverage=0,legacyCoverage=0,openingCollectible=0,collectibleAllocatedOnDate=0,openingKnown=true,balanceKnown=true;const rows=[];
 for(const row of schedules){const day=businessDay(row.date);if(day>date&&!includeUpcoming)continue;const key=id(row),amount=legacyMinor(row.amount),mapped=allMapped.get(key)||0,legacy=Math.max(0,legacyMinor(row.paidAmount)-mapped);let received=paid.get(key)||0;
  // Explicit invalidated receipts must never reappear through stale paidAmount/paidDate.
  const reconstructable=!legacy||!invalidLinked.has(key)&&(date===businessDay()||(row.paidDate&&businessDay(row.paidDate)<=date));
  const knownLegacy=legacy&&reconstructable?legacy:0;if(legacy&&!reconstructable)unattributed+=legacy;received+=knownLegacy;
  const paidAmount=Math.min(amount,Math.max(0,received)),remaining=amount-paidAmount,prior=Math.min(paidAmount,before.get(key)||0),during=Math.min(Math.max(0,paidAmount-prior),onDate.get(key)||0);
  if(day<=date){
   // Opening excludes only coverage actually received before this business day.
   // Receipt cash flow may also fund future dues and must not be subtracted wholesale.
   const legacyDate=knownLegacy&&row.paidDate?businessDay(row.paidDate):null;
   const priorDue=Math.min(amount,(before.get(key)||0)+(legacyDate&&legacyDate<date?knownLegacy:0));
   openingCollectible+=amount-priorDue;
   collectibleAllocatedOnDate+=Math.min(amount-priorDue,(onDate.get(key)||0)+(legacyDate===date?knownLegacy:0));
   // A last-paid timestamp on this date does not prove when every unmapped partial was received.
   if(legacy&&(!reconstructable||!legacyDate||legacyDate===date))openingKnown=false;
   if(legacy&&!reconstructable)balanceKnown=false;
  }
  if(day===date){target+=amount;covered+=paidAmount;priorCoverage+=prior;dayCoverage+=during;legacyCoverage+=knownLegacy;}else if(day<date)overdue+=remaining;
  if(includeUpcoming||day===date||remaining)rows.push({...row,dueDate:row.date,paidAmount:major(paidAmount),remaining:major(remaining),coveredBeforeDate:major(prior),allocatedOnDate:major(during),advanceApplied:major(Math.min(paidAmount,early.get(key)||0)),legacyCoverage:major(knownLegacy),requiresHistoryReview:invalidLinked.has(key)&&legacyMinor(row.paidAmount)>received||received>amount,historicalCoverageKnown:reconstructable,status:!remaining?'PAID':paidAmount?'PARTIALLY_PAID':day<date?'OVERDUE':day>date?'UPCOMING':'NOT_COLLECTED'});
 }
 return {openingCollectible:openingKnown?major(openingCollectible):null,collectibleAllocatedOnDate:openingKnown?major(collectibleAllocatedOnDate):null,collectibleHistoryKnown:openingKnown,collectibleBalanceKnown:balanceKnown,previousOverdue:major(overdue),todayUnpaid:major(Math.max(0,target-covered)),totalCollectible:major(overdue+Math.max(0,target-covered)),remainingCollectible:major(overdue+Math.max(0,target-covered)),overdueInstallmentCount:rows.filter(r=>businessDay(r.dueDate)<date&&r.remaining>0).length,target:major(target),covered:major(covered),collected:major(actual),remaining:major(Math.max(0,target-covered)),coveredBeforeDate:major(priorCoverage),allocatedOnDate:major(dayCoverage),legacyCoverage:major(legacyCoverage),collectionPercent:target?Math.round(covered/target*10000)/100:null,overdueAmount:major(overdue),unattributedHistoricalAmount:major(unattributed),rows};
}
async function report(user,query={}){
 await finance.authorize(user);const date=query.date||businessDay();bounds(date);
 if(query.employeeId&&!/^[a-f0-9]{24}$/i.test(query.employeeId))throw finance.error(422,'Invalid employee identifier');
 if(user.role==='EMPLOYEE'&&query.employeeId&&query.employeeId!==user.id)throw finance.error(403,'You can only view your own collection performance');
 const employeeId=user.role==='EMPLOYEE'?user.id:query.employeeId,scope=employeeId?{employeeId:new mongoose.Types.ObjectId(employeeId)}:{};
 const {page,limit}=require('./customerPortfolio.service').pageInfo(query);
 const Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Collection=require('../models/Collection'),Employee=require('../models/Employee');
 const loans=await Loan.find({...scope,status:{$ne:'CANCELLED'}}).select('_id employeeId customerId loanNumber remainingAmount status').populate('customerId','name').lean();
 const [schedules,receipts,employees]=await Promise.all([Schedule.find({loanId:{$in:loans.map(l=>l._id)}}).sort({date:1,_id:1}).lean(),Collection.find({...(employeeId?{$or:[scope,{loanId:{$in:loans.map(l=>l._id)}}]}:{})}).select('loanId loanScheduleId employeeId amountReceived allocations paymentDate status').lean(),Employee.find(employeeId?{_id:employeeId}:{}).select('name employeeCode status').lean()]);
 const loanMap=new Map(loans.map(l=>[id(l),l]));const decorated=schedules.map(s=>{const l=loanMap.get(id(s.loanId));return {...s,employeeId:l.employeeId,customerName:l.customerId?.name||'Unavailable customer',loanNumber:l.loanNumber};});
 const active=activeAtDate(loans,schedules,receipts,date),eligible=decorated.filter(s=>active.has(id(s.loanId)));
 const totals=calculate(eligible,receipts,date,employeeId),team=employees.map(e=>{const data=calculate(eligible.filter(s=>id(s.employeeId)===id(e)),receipts,date,id(e));const {rows,...summary}=data;return {...e,...summary,installmentCount:rows.length};});
 return {date,timeZone:'Asia/Kolkata',...totals,rows:totals.rows.slice((page-1)*limit,page*limit),employees:team,meta:{page,limit,total:totals.rows.length,totalPages:Math.ceil(totals.rows.length/limit)}};
}
// A loan paid off on the selected day still contributes its opening scheduled
// target. Paying early must not make the day's original target disappear.
function activeAtDate(loans,schedules,receipts,date){
 const opening=calculate(schedules,receipts,require('../utils/businessDay').addDays(date,-1),null,true),balances=new Map(),latest=new Map();
 for(const row of opening.rows)balances.set(id(row.loanId),(balances.get(id(row.loanId))||0)+legacyMinor(row.remaining));
 for(const r of receipts)if(validReceipt(r)&&r.loanId){const key=id(r.loanId),day=businessDay(r.paymentDate);if(day>(latest.get(key)||''))latest.set(key,day);}
 for(const s of schedules)if(s.paidDate&&Number.isFinite(new Date(s.paidDate).getTime())){const key=id(s.loanId),day=businessDay(s.paidDate);if(day>(latest.get(key)||''))latest.set(key,day);}
 return new Set(loans.filter(l=>l.status!=='CANCELLED'&&((balances.get(id(l))||0)>0||l.remainingAmount>0)&&(require('./overdue.service').OPEN_STATUSES.includes(l.status)||['COMPLETED','CLOSED'].includes(l.status)&&(latest.get(id(l))||'')>=date)).map(id));
}
module.exports={calculate,report,validReceipt,activeAtDate};
