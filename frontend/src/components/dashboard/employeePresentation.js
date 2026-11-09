import {businessDay} from '../../utils/businessDate.js';
export const currency=value=>Number(value||0).toLocaleString('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2});
export const receiptPercent=(collected,target)=>target>0?Math.round(collected/target*10000)/100:null;
export const shortDate=value=>new Date(value).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'});
export function installmentLabel(row,date){
 if(!row.remaining){
  let allocated=0,completed;
  for(const receipt of [...(row.receiptSummaries||[])].sort((a,b)=>String(a.paymentDate).localeCompare(String(b.paymentDate)))){allocated+=Math.round(Number(receipt.allocatedAmount||0)*100);if(allocated>=Math.round(Number(row.amount||Infinity)*100)){completed=receipt.paymentDate;break;}}
  const received=completed||row.paidDate;
  if(received){const day=businessDay(received),due=businessDay(row.dueDate);return day<due?'Paid in Advance':day>due?'Overdue Paid':'Paid On Time';}
  return businessDay(row.dueDate)>date?'Paid in Advance':'Paid';
 }
 if(row.paidAmount>0)return businessDay(row.dueDate)<date?'Partially Paid — Overdue':'Partially Paid';
 return businessDay(row.dueDate)<date?'Overdue':businessDay(row.dueDate)===date?'Due Today':'Upcoming';
}
export function timelineWindow(rows,date){
 const index=rows.findIndex(r=>businessDay(r.dueDate)>=date);
 const start=Math.min(Math.max(0,(index<0?rows.length-1:index)-2),Math.max(0,rows.length-5));
 return rows.slice(start,start+5);
}
export function latestInstallmentReceipt(row){return [...(row.receiptSummaries||[])].sort((a,b)=>String(b.paymentDate).localeCompare(String(a.paymentDate))||String(b.recordedAt).localeCompare(String(a.recordedAt)))[0];}
export function timelineCounts(rows,date){return rows.reduce((counts,row)=>{if(!row.remaining)counts.paid++;else if(row.paidAmount>0)counts.partial++;else{if(businessDay(row.dueDate)<date)counts.overdue++;else if(businessDay(row.dueDate)>date)counts.upcoming++;else counts.due++;}return counts;},{paid:0,partial:0,upcoming:0,overdue:0,due:0});}


