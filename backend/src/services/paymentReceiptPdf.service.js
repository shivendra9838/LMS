const {createRoyalPdf,money,stamp,date}=require('../utils/royalPdf');
const recorded=value=>value==null||value===''?'Not recorded':String(value);
function paymentLabel(receipt){if(receipt.status==='MISSED')return 'Missed entry - no payment received';if(receipt.status==='WAIVED')return 'Waiver entry - not a payment';if(!(Number(receipt.amount)>0))return 'No payment received';return receipt.status==='PARTIAL'?'Part payment recorded':'Customer payment recorded';}
// Uses only the authorized receipt DTO; no balances, allocations or verification are inferred.
async function generate(receipt){
 const report=await createRoyalPdf({title:'PAYMENT RECEIPT',subtitle:'Loan Installment Collection',generatedAt:receipt.generatedAt||new Date(),receipt:true});
 report.fields([['Receipt number',receipt.collectionNumber],['Customer',recorded(receipt.customerName)+' / '+recorded(receipt.customerCode)],['Loan number',receipt.loanNumber]],3);
 report.fields([['Actual payment received',stamp(receipt.date)],['System entry',stamp(receipt.recordedAt)]],2);
 const actor=receipt.receivedBy;const actorText=actor?.name?actor.name+(actor.role==='ADMIN'?' (Admin entry)':actor.employeeCode?' ('+actor.employeeCode+')':''):'Actor not recorded';
 report.hero('AMOUNT RECEIVED',money(receipt.amount),'Payment mode: '+recorded(receipt.mode)+' | Transaction reference: '+recorded(receipt.transactionReference)+' | Received / recorded by: '+actorText+' | Assigned employee: '+recorded(receipt.employeeName)+(receipt.employeeCode?' ('+receipt.employeeCode+')':''));
 report.section('Installment Allocations');
 const allocations=receipt.allocations?.length?receipt.allocations:receipt.primaryInstallment?[{...receipt.primaryInstallment,amount:null}]:[];
 if(allocations.length)report.table(['Installment','Due date',{label:'Scheduled amount (₹)',right:true},{label:'This receipt (₹)',right:true},{label:'Current installment balance (₹)',right:true}],allocations.map(row=>['Day '+recorded(row.installmentNumber),date(row.dueDate),money(row.installmentAmount),money(row.amount),money(row.currentRemainingAmount)]),[.14,.21,.20,.20,.25]);
 if(!receipt.allocations?.length)report.paragraph('Legacy allocation breakdown unavailable. A stored installment reference is not proof of the amount allocated to it; no allocation has been inferred.',8);
 report.metrics([['Total allocated from this receipt',money(receipt.totalAllocated)],['Unallocated from this receipt',money(receipt.unallocatedAmount)]],2,report.C.green);
 report.section('Current Loan Balances');
 report.metrics([['Current loan outstanding',money(receipt.currentLoanOutstanding)],['Current remaining overdue',money(receipt.currentOverdue)],['Today unpaid remaining',money(receipt.currentTodayUnpaid)]],3,report.C.blue);
 report.paragraph('Current balances include later activity; they are not historical receipt-time balances. As of '+stamp(receipt.generatedAt||new Date())+'.',7.5);
 report.section('Payment, Review & Settlement');
 const review=receipt.customerPaymentReview,verified=review?.status==='VERIFIED'&&review.verifiedAt&&Number.isFinite(new Date(review.verifiedAt).getTime())&&Number(receipt.amount)>0&&!['MISSED','WAIVED'].includes(receipt.status);
 report.table(['Record / Review','Status and recorded details'],[
 ['Customer payment record',paymentLabel(receipt)+' ('+recorded(receipt.status)+')'],
 ['Admin customer receipt review',verified?'Verified by '+recorded(review.verifiedBy?.name)+' / '+stamp(review.verifiedAt):'Not verified by Admin'],
 ['Employee-to-company settlement',receipt.settlementStatus||'UNCLASSIFIED'],
 ['Funds destination / confirmation',(receipt.receivingDestination==='EMPLOYEE'?'Employee custody':receipt.receivingDestination==='COMPANY'?'Company destination':'Unclassified')+' / '+recorded(receipt.verification)]
 ],[.38,.62]);
 report.paragraph('Customer receipt review and company receipt of funds are separate. Payment verification does not verify employee-to-company settlement.',7.5);
 if(verified&&review.remarks){report.section('Admin Receipt Review Remarks');report.paragraph(review.remarks,8);}
 if(receipt.backdateReason){report.section('Backdated Entry Reason');report.paragraph(receipt.backdateReason,8);}
 return report.save();
}
module.exports={generate,paymentLabel};
