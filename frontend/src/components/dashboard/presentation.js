export const amount=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2});
export const count=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('en-IN');
// Reports return `date`, not `_id`. Keep chronological order and never invent missing days.
export const dailySeries=rows=>[...(rows||[])].filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-31);
export const reportQuery=filters=>new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==''&&value!==undefined)).toString();
export function initialReportFilters(today){const from=new Date(today+'T12:00:00Z');from.setUTCDate(from.getUTCDate()-13);return {startDate:from.toISOString().slice(0,10),endDate:today,employeeId:'',city:'',area:'',status:'',paymentMode:''};}
