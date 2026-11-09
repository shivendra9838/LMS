const {businessDay}=require('./businessDay');
const {legacyMinor,major}=require('./money');

// Saved allocation balances are authoritative, including allocations received
// after a backdated receipt date. Never reconstruct or re-credit past payments.
function minimumPayment(rows,date){
 const effectiveDay=businessDay(date);
 let previous=0,current=0;
 for(const row of rows){
  const remaining=Math.max(0,legacyMinor(row.amount)-legacyMinor(row.paidAmount));
  const due=businessDay(row.date);
  if(due<effectiveDay)previous+=remaining;
  else if(due===effectiveDay)current+=remaining;
 }
 return {effectiveDay,previousOverdue:major(previous),todayUnpaid:major(current),minimumPayment:major(previous+current)};
}
function minimumMessage(amount){
 return `Minimum payment required is ₹${amount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}. Please enter this amount or more.`;
}
function assertMinimum(amountMinor,summary){
 if(amountMinor<legacyMinor(summary.minimumPayment))throw Object.assign(new Error(minimumMessage(summary.minimumPayment)),{status:422});
}
module.exports={minimumPayment,minimumMessage,assertMinimum};
