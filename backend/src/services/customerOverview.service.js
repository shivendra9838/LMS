const Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule');
const {OPEN_STATUSES,scheduleSummary}=require('./overdue.service');
const {legacyMinor,major}=require('../utils/money');
const {businessDay,dayStart,bounds}=require('../utils/businessDay');
// Called only after the existing customer read/ownership check. Read-only totals
// reuse saved loan balances and the same schedule summary as the loan screens.
async function summary(customer){
 const kyc=customer.kycLeadId?await require('../models/CustomerLead').findById(customer.kycLeadId).select('status approvedAt').lean():null;
 const kycStatus=customer.kycApprovedAt||kyc?.approvedAt||kyc?.status==='APPROVED'?'APPROVED':kyc?.status||'NOT_RECORDED';
 const loans=await Loan.find({customerId:customer._id}).select('_id loanNumber status remainingAmount totalPayable paidAmount').lean();
 const schedules=await Schedule.find({loanId:{$in:loans.map(l=>l._id)}}).select('loanId dayNumber date amount paidAmount paidDate').lean(),byLoan=new Map();
 for(const row of schedules){const key=String(row.loanId);if(!byLoan.has(key))byLoan.set(key,[]);byLoan.get(key).push(row);}
 let outstanding=0,overdue=0,overdueInstallments=0,oldest=null;const now=new Date(),start=bounds(businessDay(now)).start;
 for(const loan of loans){outstanding+=legacyMinor(loan.remainingAmount);if(!OPEN_STATUSES.includes(loan.status)||loan.remainingAmount<=0)continue;const rows=byLoan.get(String(loan._id))||[];const calculated=scheduleSummary(loan,rows,now);overdue+=legacyMinor(calculated.overdueAmount);overdueInstallments+=calculated.overdueInstallments;for(const row of rows)if(new Date(row.date)<start&&legacyMinor(row.amount)>legacyMinor(row.paidAmount)&&(!oldest||new Date(row.date)<oldest))oldest=new Date(row.date);}
 const openLoans=loans.filter(loan=>OPEN_STATUSES.includes(loan.status)&&loan.remainingAmount>0),openIds=new Set(openLoans.map(loan=>String(loan._id)));
 const next=schedules.filter(row=>openIds.has(String(row.loanId))&&legacyMinor(row.amount)>legacyMinor(row.paidAmount)).sort((a,b)=>new Date(a.date)-new Date(b.date)||a.dayNumber-b.dayNumber||String(a._id).localeCompare(String(b._id)))[0];
 const receipts=await require('../models/Collection').find({customerId:customer._id,amountReceived:{$gt:0}}).select('amountReceived paymentDate status').lean(),validReceipts=receipts.filter(require('./collectionPerformance.service').validReceipt);
 return {kycStatus,kycReviewStatus:kyc?.status||'NOT_RECORDED',activeLoanCount:openLoans.length,closedLoanCount:loans.filter(loan=>['COMPLETED','CLOSED'].includes(loan.status)).length,overdueInstallments,totalCollected:major(validReceipts.reduce((sum,receipt)=>sum+legacyMinor(receipt.amountReceived),0)),recordedReceiptCount:validReceipts.length,lastPaymentDate:validReceipts.length?validReceipts.map(receipt=>receipt.paymentDate).sort((a,b)=>new Date(b)-new Date(a))[0]:null,nextInstallment:next?{...require('../utils/installmentStatus').present(next),loanNumber:openLoans.find(loan=>String(loan._id)===String(next.loanId))?.loanNumber}:null,loanCount:loans.length,totalOutstanding:major(outstanding),overdueAmount:major(overdue),overdueDays:oldest?Math.max(1,Math.round((dayStart(businessDay(now))-dayStart(businessDay(oldest)))/86400000)):0,oldestUnpaidDue:oldest,timeZone:'Asia/Kolkata'};
}
module.exports={summary};
