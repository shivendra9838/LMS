const crypto = require('crypto');
const defaults = require('../config/customerRisk');
const { businessDay, dayStart } = require('../utils/businessDay');
const { legacyMinor, major } = require('../utils/money');
const key = value => String(value?._id || value);
const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const days = (later, earlier) => Math.round((dayStart(later) - dayStart(earlier)) / 86400000);

// Pure read-only projection. Cash custody, employee opinions and personal attributes are never inputs.
function calculateRisk(loans, schedules, receipts, now = new Date(), policy = defaults) {
  const asOf = businessDay(now), loanIds = new Set(loans.filter(l => l.status !== 'CANCELLED').map(key));
  const eligible = schedules.filter(s => loanIds.has(key(s.loanId)) && businessDay(s.date) <= asOf && legacyMinor(s.amount) > 0)
    .sort((a,b) => key(a.loanId).localeCompare(key(b.loanId)) || new Date(a.date)-new Date(b.date) || a.dayNumber-b.dayNumber);
  const valid = receipts.filter(r => loanIds.has(key(r.loanId)) && r.amountReceived > 0 && ['PAID','PARTIAL','EXTRA_PAYMENT'].includes(r.status) && businessDay(r.paymentDate) <= asOf);
  const receiptLinks=new Set(),validReceipts=new Set(valid);
  for(const receipt of receipts)if(loanIds.has(key(receipt.loanId))){
    for(const allocation of receipt.allocations||[])receiptLinks.add(key(allocation.scheduleId));
    // Older receipts may reference one installment without an allocations array.
    // An invalidated legacy receipt must not resurrect its stale paidDate either.
    if(!validReceipts.has(receipt)&&receipt.loanScheduleId)receiptLinks.add(key(receipt.loanScheduleId));
  }
  const mapped = new Map();
  for (const receipt of valid) for (const allocation of receipt.allocations || []) {
    const id = key(allocation.scheduleId);
    if (!mapped.has(id)) mapped.set(id, []);
    mapped.get(id).push({ receiptId:key(receipt), date: businessDay(receipt.paymentDate), amount: legacyMinor(allocation.amount) });
  }
  const metrics = { totalDueInstallments: eligible.length, onTimeCount: 0, earlyCount: 0, lateCount: 0, completedInstallments: 0,
    partialCount: 0, overdueInstallments: 0, overdueAmount: 0, maxConsecutiveMissed: 0, maxDaysLate: 0,
    unknownHistoryCount: 0, verifiedCompletedInstallments:0, legacyCompletedInstallments:0,
    completedLoans: loans.filter(l=>['COMPLETED','CLOSED'].includes(l.status)).length };
  let dueMinor=0, overdueMinor=0, streak=0, previousLoan, lateDays=0;
  const evidence=[];
  for (const s of eligible) {
    const id=key(s), loan=key(s.loanId), due=businessDay(s.date), amount=legacyMinor(s.amount), stored=legacyMinor(s.paidAmount);
    const allocations=(mapped.get(id)||[]).sort((a,b)=>a.date.localeCompare(b.date) || a.receiptId.localeCompare(b.receiptId) || a.amount-b.amount);
    const allocated=allocations.reduce((sum,a)=>sum+a.amount,0);
    // Stored coverage is authoritative for current debt; allocation dates are authoritative for behavior.
    const paid=Math.min(amount,stored), remaining=amount-paid;
    let completion=null, sum=0;
    for (const a of allocations) { sum+=a.amount; if(sum>=amount){completion=a.date;break;} }
    const inconsistent=allocated>stored || (allocated<stored && allocations.length>0);
    // Legacy full installments may have a real paidDate but no allocations. Never invent one.
    if (!allocations.length && !receiptLinks.has(id) && paid===amount && s.paidDate && businessDay(s.paidDate)<=asOf) completion=businessDay(s.paidDate);
    const unknown=inconsistent || (paid>0 && !allocations.length && !completion) || (paid===amount && !completion);
    if(unknown)metrics.unknownHistoryCount++;
    dueMinor+=amount;
    if(paid>0&&remaining>0)metrics.partialCount++;
    if(due<asOf&&remaining>0){metrics.overdueInstallments++;overdueMinor+=remaining;}
    let late=0;
    if(paid===amount&&!unknown&&completion){metrics.completedInstallments++;late=Math.max(0,days(completion,due));
      if(allocations.length&&allocated===paid)metrics.verifiedCompletedInstallments++;else metrics.legacyCompletedInstallments++;
      if(completion<due)metrics.earlyCount++;else if(completion===due)metrics.onTimeCount++;else {metrics.lateCount++;lateDays+=late;}}
    const missed=due<asOf && (remaining>0 || (!unknown&&completion>due));
    if(previousLoan!==loan)streak=0;
    streak=missed?streak+1:0;previousLoan=loan;metrics.maxConsecutiveMissed=Math.max(metrics.maxConsecutiveMissed,streak);
    metrics.maxDaysLate=Math.max(metrics.maxDaysLate,late,due<asOf&&remaining>0?days(asOf,due):0);
    evidence.push({installmentId:id,loanId:loan,due,amountMinor:amount,paidMinor:paid,completion,unknown,allocations});
  }
  metrics.overdueAmount=major(overdueMinor);
  const n=metrics.totalDueInstallments||1, w=policy.weights;
  const penalties={ lateRate: w.lateRate*metrics.lateCount/n, overdueRatio: w.overdueRatio*(dueMinor?overdueMinor/dueMinor:0),
    lateness: w.lateness*Math.min(1,(metrics.lateCount?lateDays/metrics.lateCount:0)/policy.latenessCapDays),
    consecutiveMisses: w.consecutiveMisses*Math.min(1,metrics.maxConsecutiveMissed/policy.consecutiveCap), partialRate: w.partialRate*metrics.partialCount/n };
  let rawScore=Math.max(0,Math.min(100,Math.round(100-Object.values(penalties).reduce((a,b)=>a+b,0))));
  const reviewGuardrail=policy.goodRequiresNoAdverseHistory && (metrics.overdueInstallments>0 || metrics.partialCount>0 || metrics.lateCount>0);
  if(reviewGuardrail)rawScore=Math.min(rawScore,policy.thresholds.good-1);
  const sufficient=metrics.totalDueInstallments>=policy.minDueInstallments && metrics.completedInstallments>=policy.minCompletedInstallments && !metrics.unknownHistoryCount;
  const category=rawScore<policy.thresholds.review?'HIGH_RISK':rawScore<policy.thresholds.good?'REVIEW_REQUIRED':sufficient?'GOOD':'INSUFFICIENT_HISTORY';
  const provisionalPolicy=policy.provisional;
  const provisional=!sufficient&&Boolean(provisionalPolicy)&&metrics.totalDueInstallments>=provisionalPolicy.minDueInstallments&&metrics.verifiedCompletedInstallments>=provisionalPolicy.minVerifiedCompletedInstallments&&!metrics.unknownHistoryCount;
  const ratingStatus=sufficient?'ESTABLISHED':provisional?'PROVISIONAL':'UNRATED';
  const score=ratingStatus==='UNRATED'?null:rawScore;
  const confidence={level:ratingStatus==='UNRATED'?'NONE':provisional?'LOW':metrics.totalDueInstallments>=(policy.confidence?.highDueInstallments||15)&&metrics.verifiedCompletedInstallments>=(policy.confidence?.highVerifiedCompletedInstallments||10)?'HIGH':'MODERATE',
    observedInstallments:metrics.totalDueInstallments,verifiedCompletedInstallments:metrics.verifiedCompletedInstallments,knownCompletedInstallments:metrics.completedInstallments,legacyCompletedInstallments:metrics.legacyCompletedInstallments,
    explanation:'Evidence-strength indicator, not a statistical probability or a credit-bureau confidence score.'};
  const evidenceNeeded={dueInstallments:Math.max(0,(provisionalPolicy?.minDueInstallments||policy.minDueInstallments)-metrics.totalDueInstallments),verifiedCompletedInstallments:Math.max(0,(provisionalPolicy?.minVerifiedCompletedInstallments||policy.minCompletedInstallments)-metrics.verifiedCompletedInstallments),incompleteHistory:metrics.unknownHistoryCount};
  const reasons=[`${metrics.onTimeCount} installments completed on time; ${metrics.earlyCount} completed in advance.`,
    `${metrics.lateCount} completed late; maximum lateness including unpaid arrears: ${metrics.maxDaysLate} days.`,
    `${metrics.overdueInstallments} currently overdue installments; overdue balance ₹${metrics.overdueAmount.toFixed(2)}.`,
    `Maximum consecutive missed due dates within a loan: ${metrics.maxConsecutiveMissed}.`];
  if(metrics.partialCount)reasons.push(`${metrics.partialCount} due installments are partially paid; only the unpaid balance is overdue.`);
  if(reviewGuardrail)reasons.push('Policy requires review when there is a late completion, a partial due installment or a current overdue balance; the score is capped below Good.');
  if(!sufficient)reasons.push(`Good requires at least ${policy.minDueInstallments} due and ${policy.minCompletedInstallments} completed installments with known payment dates. Clear adverse evidence can still require review or indicate high risk.`);
  if(metrics.unknownHistoryCount)reasons.push(`${metrics.unknownHistoryCount} installments have incomplete or inconsistent historical allocation dates. Review the original records.`);
  if(provisional)reasons.push(`Provisional — Limited History: ${metrics.totalDueInstallments} due installments, ${metrics.verifiedCompletedInstallments} fully covered by valid dated payment allocations. The decision-support category remains separate.`);
  if(ratingStatus==='UNRATED')reasons.push(`Not Rated Yet: ${evidenceNeeded.dueInstallments} more due installments and ${evidenceNeeded.verifiedCompletedInstallments} more verified completed installments are needed for provisional scoring; ${evidenceNeeded.incompleteHistory} incomplete histories need review. Adverse arrears may still determine the decision-support category.`);
  return {version:policy.version,policyHash:fingerprint(policy),inputHash:fingerprint({loans:loans.map(l=>({id:key(l),status:l.status})).sort((a,b)=>a.id.localeCompare(b.id)),evidence}),asOf,timeZone:'Asia/Kolkata',calculatedAt:new Date(now),
    score,ratingStatus,confidence,evidenceNeeded,category,metrics,reasons,penalties,policy,evidence,decisionSupportOnly:true};
}
module.exports={calculateRisk};
