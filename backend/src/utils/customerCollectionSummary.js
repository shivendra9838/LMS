// Read-only customer projection over the existing date-aware allocation ledger.
const {businessDay}=require('./businessDay');
const {legacyMinor,major}=require('./money');
const id=v=>String(v?._id||v);
function summarize(customers,rows,date,search=''){
 return customers.map(customer=>{
  const own=rows.filter(r=>id(r.customerId)===id(customer)),due=own.filter(r=>businessDay(r.dueDate)<=date),open=due.filter(r=>r.activeAtDate&&r.remaining>0);
  const sum=(items,key)=>major(items.reduce((n,r)=>n+legacyMinor(r[key]||0),0));
  const previousOverdue=sum(open.filter(r=>businessDay(r.dueDate)<date),'remaining'),todayDue=sum(open.filter(r=>businessDay(r.dueDate)===date),'remaining'),remaining=major(legacyMinor(previousOverdue)+legacyMinor(todayDue));
  const loans=[...new Set(own.map(r=>id(r.loanId)))].map(loanId=>{
   const installments=own.filter(r=>id(r.loanId)===loanId),outstanding=installments.filter(r=>r.activeAtDate&&r.remaining>0&&businessDay(r.dueDate)<=date);
   const candidate=installments.find(r=>r.currentSchedule.canCollect);
   return {loanId,loanNumber:installments[0].loanNumber,remaining:sum(outstanding,'remaining'),currentSchedule:candidate?.currentSchedule||null,installments};
  });
  const status=previousOverdue>0?'Overdue':todayDue>0?((open.some(r=>r.paidAmount>0)||due.some(r=>r.allocatedOnDate>0))?'Partially Paid':'Due Today'):due.length&&due.every(r=>r.remaining===0)?'Paid':own.length?'Upcoming':'No dues';
  return {_id:id(customer),customerId:id(customer),customerName:customer.name,customerCode:customer.customerCode,mobile:customer.mobile,canViewCustomer:true,previousOverdue,todayDue,totalDue:remaining,remaining,received:sum(own,'actualReceived'),paidOnDues:sum(due,'allocatedOnDate'),needsCollection:remaining>0,matchesToday:previousOverdue>0||own.some(r=>r.activeAtDate&&businessDay(r.dueDate)===date),status,loans,requiresHistoryReview:open.some(r=>r.requiresHistoryReview),currentSchedule:loans.find(l=>l.remaining>0&&l.currentSchedule)?.currentSchedule||null};
 }).filter(c=>!search||[c.customerName,c.customerCode,c.mobile,...c.loans.map(l=>l.loanNumber)].some(v=>String(v||'').toLocaleLowerCase().includes(search)));
}
module.exports={summarize};
