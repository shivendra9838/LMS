export const requestLabels={PENDING:'Pending',CORRECTION_REQUIRED:'Correction Required',APPROVED:'Approved',REJECTED:'Rejected'};
export const customerRequestPath=row=>row.customerId?'/admin/customers/'+(row.customerId._id||row.customerId):null;
export const kycRequestPath=row=>row.kycVersion?'/admin/customers/kyc/'+row._id:null;
export const canReviewRequest=row=>row.status==='PENDING';
export function requestPreset(value,today){if(value==='all')return {startDate:'',endDate:''};const start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-(value==='week'?6:value==='month'?29:0));return {startDate:start.toISOString().slice(0,10),endDate:today};}
export const requestQuery=values=>new URLSearchParams(Object.entries(values).filter(([,value])=>value!==''&&value!==undefined)).toString();
