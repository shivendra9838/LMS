const {legacyMinor,major}=require('./money');
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
// Pure integer-paise planner. Callers supply the oldest-unpaid contractual order;
// the save path obtains those rows inside the existing MongoDB transaction.
function plan(rows,receivedMinor){
 if(!Number.isSafeInteger(receivedMinor)||receivedMinor<=0)fail('Use a positive payment amount');
 let left=receivedMinor;const allocations=[],remaining=[];
 for(const row of rows){const scheduled=legacyMinor(row.amount),paid=legacyMinor(row.paidAmount);if(paid>scheduled)fail('An installment balance needs Admin review');const outstanding=scheduled-paid;if(!outstanding)continue;const applied=Math.min(left,outstanding);if(applied){allocations.push({scheduleId:row._id,dayNumber:row.dayNumber,dueDate:row.date,amountMinor:applied,paidBeforeMinor:paid,remainingMinor:outstanding-applied});left-=applied;}if(outstanding-applied>0)remaining.push({dayNumber:row.dayNumber,remainingAmount:major(outstanding-applied)});}
 if(left)fail('The installment schedule does not reconcile with the loan balance. No payment was recorded.');
 return {allocations,nextInstallment:remaining[0]||null,totalAllocatedMinor:receivedMinor,unallocatedMinor:0};
}
module.exports={plan};
