const {calculateRisk}=require('../../src/services/customerRiskCalculator');
const policy=require('../../src/config/customerRisk');
const now=new Date('2026-10-27T12:00:00Z'),loans=[{_id:'loan',status:'ACTIVE'}];
const schedule=(i,extra={})=>({_id:'s'+i,loanId:'loan',dayNumber:i,date:`2026-10-${String(19+i).padStart(2,'0')}T18:30:00.000Z`,amount:700,paidAmount:0,...extra});
const payment=(s,date,amount=700)=>({loanId:'loan',status:amount<700?'PARTIAL':'PAID',paymentDate:date,createdAt:'2026-10-27T12:00:00Z',amountReceived:amount,allocations:[{scheduleId:s._id,dueDate:s.date,amount}]});
const run=(s=[],r=[],l=loans)=>calculateRisk(l,s,r,now);

test('v2 publishes provisional only after three due and three verified completions, then established at five due',()=>{
 const s=[1,2,3].map(i=>schedule(i,{paidAmount:700})),r=s.map(row=>payment(row,row.date));
 expect(run(s.slice(0,1),r.slice(0,1))).toMatchObject({version:'repayment-v2',ratingStatus:'UNRATED',score:null,evidenceNeeded:{dueInstallments:2,verifiedCompletedInstallments:2}});
 expect(run(s,r)).toMatchObject({ratingStatus:'PROVISIONAL',score:100,category:'INSUFFICIENT_HISTORY',confidence:{level:'LOW',observedInstallments:3,verifiedCompletedInstallments:3}});
 s.push(schedule(4),schedule(5));expect(run(s,r)).toMatchObject({ratingStatus:'ESTABLISHED',confidence:{level:'MODERATE'}});
});
test('arrears can require High Risk without inventing a numeric rating in the absence of meaningful payment history',()=>{
 expect(run([1,2,3,4,5].map(i=>schedule(i)))).toMatchObject({category:'HIGH_RISK',ratingStatus:'UNRATED',score:null,confidence:{level:'NONE'}});
});
test('future paid installments do not count as observed history for provisional scoring',()=>{
 const s=[8,9,10].map(i=>schedule(i,{paidAmount:700})),r=s.map(row=>payment(row,'2026-10-26'));
 expect(run(s,r)).toMatchObject({ratingStatus:'UNRATED',score:null,metrics:{totalDueInstallments:0,verifiedCompletedInstallments:0}});
});
test('invalidated receipts cannot recover positive evidence from a stale paidDate',()=>{
 const s=[1,2,3].map(i=>{const row=schedule(i,{paidAmount:700});row.paidDate=row.date;return row;}),r=s.map(row=>payment(row,row.date));
 expect(run(s,r).ratingStatus).toBe('PROVISIONAL');r[0].status='VOIDED';
 expect(run(s,r)).toMatchObject({ratingStatus:'UNRATED',score:null,metrics:{unknownHistoryCount:1,verifiedCompletedInstallments:2}});
});
test('invalidated legacy receipts without allocations also block stale paidDate fallback',()=>{
 const s=[1,2,3,4,5].map(i=>{const row=schedule(i,{paidAmount:700});row.paidDate=row.date;return row;});
 const r=s.map(row=>({...payment(row,row.date),loanScheduleId:row._id,allocations:[],status:'VOIDED'}));
 expect(run(s,r)).toMatchObject({ratingStatus:'UNRATED',score:null,metrics:{completedInstallments:0,unknownHistoryCount:5}});
});
test('IST midnight creates overdue evidence without a payment or schedule mutation',()=>{
 const s=[{...schedule(1),date:'2026-10-27T00:00:00+05:30'}],before=JSON.stringify(s);
 const a=calculateRisk(loans,s,[],new Date('2026-10-27T18:29:59Z')),b=calculateRisk(loans,s,[],new Date('2026-10-27T18:30:00Z'));
 expect(a.metrics.overdueAmount).toBe(0);expect(b.metrics.overdueAmount).toBe(700);expect(a.asOf).not.toBe(b.asOf);expect(JSON.stringify(s)).toBe(before);
});
test('new customer and a single advance receipt never become Good',()=>{
 expect(run()).toMatchObject({category:'INSUFFICIENT_HISTORY',score:null});
 const s=schedule(1,{paidAmount:700});expect(run([s],[payment(s,'2026-10-19T12:00:00Z')])).toMatchObject({category:'INSUFFICIENT_HISTORY',metrics:{earlyCount:1}});
});
test('sufficient actual on-time and advance history scores Good; completed loans are included',()=>{
 const s=Array.from({length:5},(_,i)=>schedule(i+1,{paidAmount:700}));
 const r=s.map(row=>payment(row,row.date));r[0].paymentDate='2026-10-19T12:00:00Z';
 expect(run(s,r,[{_id:'loan',status:'COMPLETED'}])).toMatchObject({category:'GOOD',score:100,metrics:{onTimeCount:4,earlyCount:1,completedLoans:1}});
});
test('several missed installments including matured loan increase risk and remain recoverable',()=>{
 const s=[1,2,3,4,5].map(i=>schedule(i));expect(run(s)).toMatchObject({category:'HIGH_RISK',metrics:{overdueInstallments:5,overdueAmount:3500,maxConsecutiveMissed:5}});
});
test('real repayment clears current overdue without erasing previous late behavior',()=>{
 const s=[1,2,3,4,5].map(i=>schedule(i)),before=run(s);s.forEach(row=>row.paidAmount=700);
 const after=run(s,s.map(row=>payment(row,'2026-10-26T12:00:00Z')));
 expect(after.metrics.overdueAmount).toBe(0);expect(after.metrics.lateCount).toBe(5);expect(before.score).toBeNull();expect(after.score).toEqual(expect.any(Number));
});
test('partial payment penalizes only the real remaining balance; completion uses last covering receipt',()=>{
 const s=schedule(1,{paidAmount:200});const partial=run([s],[payment(s,'2026-10-21T12:00:00Z',200)]);expect(partial.metrics).toMatchObject({partialCount:1,overdueAmount:500,completedInstallments:0});
 s.paidAmount=700;const full=run([s],[payment(s,'2026-10-19T12:00:00Z',200),payment(s,'2026-10-22T12:00:00Z',500)]);expect(full.metrics).toMatchObject({lateCount:1,earlyCount:0,overdueAmount:0});
});
test('backdated received day is used instead of entry timestamp; IST midnight is respected',()=>{
 const s=schedule(1,{paidAmount:700});const r=payment(s,'2026-10-20T18:45:00Z');expect(run([s],[r]).metrics.onTimeCount).toBe(1);
 r.paymentDate='2026-10-20T18:00:00Z';expect(run([s],[r]).metrics.earlyCount).toBe(1);
});
test('one receipt across multiple installments allocates once per installment',()=>{
 const s=[1,2,3].map(i=>schedule(i,{paidAmount:700})),r=payment(s[0],'2026-10-19T12:00:00Z',2100);r.allocations=s.map(row=>({scheduleId:row._id,dueDate:row.date,amount:700}));expect(run(s,[r]).metrics).toMatchObject({completedInstallments:3,earlyCount:3,overdueAmount:0});
});
test('future installments and unpaid today are never marked missed',()=>{
 const future=schedule(10),today=schedule(7);expect(run([today,future]).metrics).toMatchObject({totalDueInstallments:1,overdueInstallments:0,maxConsecutiveMissed:0});
});
test('missing dates and inconsistent allocation coverage cannot yield Good',()=>{
 const s=[1,2,3,4,5].map(i=>schedule(i,{paidAmount:700}));expect(run(s).category).toBe('INSUFFICIENT_HISTORY');expect(run(s).metrics.unknownHistoryCount).toBe(5);
 const r=s.map(row=>payment(row,row.date,500));expect(run(s,r).metrics.unknownHistoryCount).toBe(5);
});
test('legacy actual paidDate is supported without inventing receipts',()=>{
 const s=[1,2,3,4,5].map(i=>{const row=schedule(i,{paidAmount:700});row.paidDate=row.date;return row;});expect(run(s)).toMatchObject({category:'GOOD',metrics:{onTimeCount:5}});
});
test('cancelled loans, non-payment entries and future receipts provide no positive behavior evidence',()=>{
 const s=schedule(1,{paidAmount:700}),r=payment(s,s.date);expect(run([s],[r],[{_id:'loan',status:'CANCELLED'}]).metrics.totalDueInstallments).toBe(0);
 for(const status of ['MISSED','WAIVED','VOIDED','CANCELLED'])expect(run([s],[{...r,status}]).metrics.completedInstallments).toBe(0);
 expect(run([s],[{...r,paymentDate:'2026-10-28'}]).metrics.completedInstallments).toBe(0);
});
test('policy is configurable and hashes change when dates, allocations or policy change; no mutation',()=>{
 const s=[schedule(1)],before=JSON.stringify(s),a=run(s);const changed=calculateRisk(loans,s,[],now,{...policy,thresholds:{good:90,review:60}});expect(changed.policyHash).not.toBe(a.policyHash);s[0].date='2026-10-25';expect(run(s).inputHash).not.toBe(a.inputHash);s[0]=schedule(1);expect(JSON.stringify(s)).toBe(before);
 expect(calculateRisk(loans,s,[],now,{...policy,goodRequiresNoAdverseHistory:false,weights:{lateRate:0,overdueRatio:0,lateness:0,consecutiveMisses:0,partialRate:0}}).category).toBe('INSUFFICIENT_HISTORY');
});
test('a small overdue balance or occasional late completion requires review even with strong history',()=>{
 const s=[1,2,3,4,5].map(i=>schedule(i,{paidAmount:700}));s[4].paidAmount=699;
 const r=s.map(row=>payment(row,row.date,row.paidAmount));expect(run(s,r)).toMatchObject({category:'REVIEW_REQUIRED',score:79,metrics:{overdueAmount:1}});
 s[4].paidAmount=700;r[4]=payment(s[4],'2026-10-26T12:00:00Z');expect(run(s,r).category).toBe('REVIEW_REQUIRED');
});
test('due-date corrections and reversals are reflected without stale cached calculations',()=>{
 const s=[1,2,3,4,5].map(i=>schedule(i,{paidAmount:700})),r=s.map(row=>payment(row,row.date));const good=run(s,r);expect(good.category).toBe('GOOD');
 s[0].date='2026-10-18T18:30:00Z';expect(run(s,r).metrics.lateCount).toBe(1);expect(run(s,r).inputHash).not.toBe(good.inputHash);
 s[0].paidAmount=0;r[0].status='VOIDED';expect(run(s,r).metrics.overdueAmount).toBe(700);expect(run(s,r).category).not.toBe('GOOD');
});
test('missed streaks never cross loan boundaries and settlement data cannot change scores',()=>{
 const second={_id:'second',status:'ACTIVE'},s=[schedule(1),{...schedule(2),_id:'s2b',loanId:'second'}];const a=run(s,[],[...loans,second]);expect(a.metrics.maxConsecutiveMissed).toBe(1);
 expect(run(s,[],[...loans,{...second,settlementStatus:'UNSETTLED',religion:'unused',gender:'unused'}]).score).toBe(a.score);
});
