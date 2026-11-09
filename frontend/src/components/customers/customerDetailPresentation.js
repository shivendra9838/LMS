import {businessDay} from '../../utils/businessDate.js';
export const customerDetailTabs=[['overview','Overview'],['personal','Personal & Contact'],['kyc','Approved KYC & Documents'],['loans','Loan Accounts'],['installments','Installment Schedule'],['payments','Payments & Collections'],['overdue','Overdue & Advance'],['history','Timeline & Audit']];
export const detailTab=value=>customerDetailTabs.some(([key])=>key===value)?value:'overview';
export const recorded=value=>value===undefined||value===null||value===''?'Not recorded':value;
export const formatCustomerMoney=value=>value===undefined||value===null||value===''||!Number.isFinite(Number(value))?'Not recorded':Number(value).toLocaleString('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2});
export const paymentTiming=value=>({PAID_EARLY:'Paid in Advance',PAID_ON_TIME:'Paid On Time',PAID_LATE:'Paid Late',PARTIAL_EARLY:'Partially Paid in Advance'})[value]||value;
export function customerDetailQuery(previous,tab){const next=new URLSearchParams(previous);next.set('tab',detailTab(tab));next.delete('page');next.set('scope',tab==='overdue'?'OVERDUE':'ALL');return next;}
export const maskCustomerIdentity=value=>value?'•••• '+String(value).slice(-4):'Not recorded';

export function installmentBadge(row,now=new Date()){const due=row.dueDate||row.date;if(row.displayStatus==='PENDING'&&due&&businessDay(due)>businessDay(now))return {value:'UPCOMING',label:'Upcoming'};return {value:row.overdue?'OVERDUE':row.displayStatus,label:(row.statusLabel||row.status||'Not recorded')+(row.overdue&&row.displayStatus==='PARTIAL'?' · Overdue':'')};}

export function receiptPresentation(payment,now=new Date()){
 if(payment.status==='MISSED')return {kind:'Missed-payment marker',received:false};
 if(payment.status==='WAIVED')return {kind:'Waiver record',received:false};
 if(!['PAID','PARTIAL','EXTRA_PAYMENT'].includes(payment.status)||!Number.isFinite(Number(payment.amountReceived))||Number(payment.amountReceived)<=0)return {kind:'Record without a received payment',received:false};
 if(!payment.paymentDate||!Number.isFinite(new Date(payment.paymentDate).getTime()))return {kind:'Receipt date unavailable',received:false};
 if(businessDay(payment.paymentDate)>businessDay(now))return {kind:'Future-dated record',received:false};
 return {kind:payment.backdateReason?'Backdated receipt':'Recorded customer receipt',received:true};
}

// Approval and account activation are independent. A pending revision does not erase an approved snapshot.
export function customerKycPresentation(customer){
 const approved=customer.kycStatus==='APPROVED'||(!customer.kycStatus&&Boolean(customer.kycApprovedAt));
 const review=customer.kycReviewStatus||customer.kycStatus||'NOT_RECORDED';
 const value=approved?'APPROVED':review;
 const labels={APPROVED:'KYC Verified',PENDING:'KYC Pending Approval',CORRECTION_REQUIRED:'KYC Corrections Required',REJECTED:'KYC Rejected',DRAFT:'KYC Draft',NOT_RECORDED:'KYC Not Recorded'};
 return {value,label:labels[value]||'KYC status unavailable',revision:approved&&review!=='APPROVED'&&review!=='NOT_RECORDED'?'Current revision: '+(labels[review]||review.replaceAll('_',' ')):null};
}
