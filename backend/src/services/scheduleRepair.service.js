const crypto=require('crypto');
const Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Collection=require('../models/Collection'),Audit=require('../models/AuditLog');
const {legacyMinor,major}=require('../utils/money');
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const error=message=>Object.assign(new Error(message),{status:409});
async function snapshot(loanId,session) {
 const loan=await Loan.findById(loanId).session(session||null).lean();
 const schedules=await Schedule.find({loanId}).sort({dayNumber:1}).session(session||null).lean();
 const payments=await Collection.find({loanId}).sort({_id:1}).session(session||null).lean();
 return {loan,schedules,payments};
}
function planFor({loan,schedules,payments}) {
 if(!loan)throw error('Loan not found');
 const total=schedules.reduce((n,s)=>n+legacyMinor(s.amount),0),delta=legacyMinor(loan.totalPayable)-total;
 if(!delta)return {loanNumber:loan.loanNumber,action:'NONE'};
 const last=schedules.at(-1),ledger=payments.reduce((n,c)=>n+legacyMinor(c.amountReceived),0);
 const eligible=last&&schedules.length===loan.durationDays&&last.dayNumber===loan.durationDays&&legacyMinor(last.paidAmount)===0&&last.status==='PENDING'&&legacyMinor(last.amount)+delta>0&&Math.abs(delta)<=loan.durationDays&&ledger===legacyMinor(loan.paidAmount)&&schedules.reduce((n,s)=>n+legacyMinor(s.paidAmount),0)===ledger&&['ACTIVE','DEFAULTED'].includes(loan.status);
 if(!eligible)return {loanNumber:loan.loanNumber,action:'MANUAL_REVIEW',reason:'Schedule mismatch is not an eligible unpaid final-installment rounding adjustment'};
 return {version:1,action:'ADJUST_UNPAID_FINAL_INSTALLMENT',loanNumber:loan.loanNumber,loanId:String(loan._id),scheduleId:String(last._id),beforeAmount:last.amount,afterAmount:major(legacyMinor(last.amount)+delta),difference:major(delta),loanHash:fingerprint(loan),schedulesHash:fingerprint(schedules),paymentsHash:fingerprint(payments),reason:'Reconcile the unpaid final installment to the existing contracted total; no payment, date, loan balance or custody changes'};
}
async function applyPlan(plan,user) {
 const finance=require('./settlement.service');await finance.authorize(user,true);
 return finance.transaction(async session=>{
  const current=await snapshot(plan.loanId,session),actual=planFor(current);
  if(actual.action!=='ADJUST_UNPAID_FINAL_INSTALLMENT'||fingerprint(actual)!==fingerprint(plan))throw error('Reviewed plan is stale or changed. Generate and review a new dry run');
  await Loan.updateOne({_id:plan.loanId},{$inc:{__v:1}},{session});
  const changed=await Schedule.updateOne({_id:plan.scheduleId,amount:plan.beforeAmount,paidAmount:0,status:'PENDING'},{$set:{amount:plan.afterAmount}},{session});
  if(changed.modifiedCount!==1)throw error('Final installment changed; no repair applied');
  const [audit]=await Audit.create([{userId:user.id,userModel:'Admin',userRole:'ADMIN',action:'FINAL_INSTALLMENT_ROUNDING_REPAIRED',module:'FINANCIAL_REPAIR',referenceId:plan.loanId,oldValue:{amount:plan.beforeAmount},newValue:{amount:plan.afterAmount,scheduleId:plan.scheduleId,paymentsHash:plan.paymentsHash,paidAmount:current.loan.paidAmount,planHash:fingerprint(plan),reason:plan.reason}}],{session});
  return {auditId:String(audit._id),loanNumber:plan.loanNumber,difference:plan.difference};
 });
}
async function rollback(auditId,user) {
 const finance=require('./settlement.service');await finance.authorize(user,true);
 return finance.transaction(async session=>{
  const original=await Audit.findOne({_id:auditId,module:'FINANCIAL_REPAIR',action:'FINAL_INSTALLMENT_ROUNDING_REPAIRED'}).session(session).lean();
  if(!original)throw error('Repair audit record not found');
  if(await Audit.exists({module:'FINANCIAL_REPAIR',action:'FINAL_INSTALLMENT_ROUNDING_REVERSED','newValue.originalAuditId':String(auditId)}).session(session))throw error('Repair was already reversed');
  const current=await snapshot(original.referenceId,session),last=current.schedules.find(s=>String(s._id)===original.newValue.scheduleId);
  if(!last||last.amount!==original.newValue.amount||last.paidAmount!==0||last.status!=='PENDING'||current.loan.paidAmount!==original.newValue.paidAmount||fingerprint(current.payments)!==original.newValue.paymentsHash)throw error('Financial activity changed since repair; reversal requires manual review');
  await Loan.updateOne({_id:current.loan._id},{$inc:{__v:1}},{session});
  await Schedule.updateOne({_id:last._id,amount:last.amount,paidAmount:0},{$set:{amount:original.oldValue.amount}},{session});
  await Audit.create([{userId:user.id,userModel:'Admin',userRole:'ADMIN',module:'FINANCIAL_REPAIR',action:'FINAL_INSTALLMENT_ROUNDING_REVERSED',referenceId:original.referenceId,oldValue:{amount:last.amount},newValue:{amount:original.oldValue.amount,originalAuditId:String(auditId)}}],{session});
  return {reversed:true,auditId:String(auditId)};
 });
}
module.exports={snapshot,planFor,applyPlan,rollback};
