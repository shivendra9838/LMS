const {calculate}=require('../../src/services/collectionPerformance.service');
const date='2026-10-27',row=(id,day,paidAmount=0)=>({_id:id,date:day+'T00:00:00+05:30',amount:700,paidAmount}),receipt=(day,amount,allocations)=>({paymentDate:day+'T12:00:00+05:30',amountReceived:amount,allocations:allocations.map(([scheduleId,amount])=>({scheduleId,amount})),employeeId:'employee',status:'PAID'});
test('uncollected scheduled target and mature overdue amounts remain recoverable',()=>{expect(calculate([row('a',date),row('old','2026-08-01')],[],date)).toMatchObject({target:700,collected:0,remaining:700,overdueAmount:700,collectionPercent:0});});
test('advance receipts cover today without appearing as new cash today',()=>{expect(calculate([row('a',date,700)],[receipt('2026-10-26',700,[['a',700]])],date)).toMatchObject({target:700,covered:700,collected:0,remaining:0,collectionPercent:100});});
test('combined overdue, partial today and future allocation counts a receipt once',()=>{const r=calculate([row('old','2026-10-26',700),row('a',date,200),row('future','2026-10-28',700)],[receipt(date,1600,[['old',700],['a',200],['future',700]])],date);expect(r).toMatchObject({target:700,collected:1600,covered:200,remaining:500,overdueAmount:0,collectionPercent:28.57});expect(r.rows[0].status).toBe('PARTIALLY_PAID');});
test('later recorded backdated receipt belongs to actual received date',()=>{const payment={...receipt('2026-10-26',200,[['a',200]]),createdAt:'2026-10-27T12:00:00Z'};expect(calculate([row('a','2026-10-26',200)],[payment],'2026-10-26')).toMatchObject({collected:200,covered:200,remaining:500});});
test('later receipts never pay historical target early and no target has N/A percentage',()=>{expect(calculate([row('a','2026-10-26',700)],[receipt(date,700,[['a',700]])],'2026-10-26')).toMatchObject({remaining:700,collected:0,covered:0});expect(calculate([],[],date).collectionPercent).toBeNull();});
test('legacy historical ambiguity is disclosed instead of inventing receipt dates',()=>{const r=calculate([{...row('a','2026-10-20',700),paidDate:'2026-10-27'}],[],'2026-10-21');expect(r.unattributedHistoricalAmount).toBe(700);expect(r.rows[0].historicalCoverageKnown).toBe(false);});
test('loan reassignment preserves old collector cash attribution and schedule coverage',()=>{expect(calculate([row('a',date,700)],[receipt(date,700,[['a',700]])],date,'new-employee')).toMatchObject({covered:700,collected:0});});

test('800 cash receipt remains 800 while 700 covers the due row and 100 advances the next row',()=>{
 const r=calculate([row('a',date,700),row('b','2026-10-28',100)],[receipt(date,800,[['a',700],['b',100]])],date,'employee',true);
 expect(r).toMatchObject({target:700,collected:800,covered:700,remaining:0,allocatedOnDate:700});expect(r.rows[1]).toMatchObject({paidAmount:100,advanceApplied:100,remaining:600,status:'PARTIALLY_PAID'});
 const next=calculate([row('a',date,700),row('b','2026-10-28',100)],[receipt(date,800,[['a',700],['b',100]])],'2026-10-28','employee',true);expect(next).toMatchObject({target:700,collected:0,coveredBeforeDate:100,allocatedOnDate:0,remaining:600});
});
test('partial 300, multiple modes and receipt identity deduplication reconcile independently of coverage',()=>{
 const a={...receipt(date,300,[['a',300]]),_id:'one',paymentMode:'CASH'},b={...receipt(date,100,[['a',100]]),_id:'two',paymentMode:'UPI'};
 expect(calculate([row('a',date,400)],[a,a,b],date)).toMatchObject({target:700,collected:400,covered:400,remaining:300,allocatedOnDate:400});
});
test('voided/reversed receipts cannot be resurrected from stale paidAmount or paidDate',()=>{
 for(const status of ['VOIDED','REVERSED','MISSED','WAIVED']){const payment={...receipt(date,700,[['a',700]]),status,loanScheduleId:'a'};const data=calculate([{...row('a',date,700),paidDate:date}],[payment],date);expect(data).toMatchObject({collected:0,covered:0,remaining:700});expect(data.rows[0].requiresHistoryReview).toBe(true);}
});
test('legacy invalid primary reference without allocation array does not imply payment coverage',()=>{
 const payment={...receipt(date,700,[]),status:'VOIDED',loanScheduleId:'a'},data=calculate([{...row('a',date,700),paidDate:date}],[payment],date);expect(data).toMatchObject({collected:0,remaining:700,unattributedHistoricalAmount:700});
});
test('a future-dated receipt is not treated as received money',()=>{
 const future=require('../../src/utils/businessDay').addDays(require('../../src/utils/businessDay').businessDay(),1);expect(require('../../src/services/collectionPerformance.service').validReceipt(receipt(future,700,[['a',700]]))).toBe(false);
});

test('collectible includes only overdue plus today unpaid and never subtracts future-directed receipt twice',()=>{const data=calculate([row('old','2026-10-26',700),row('now',date,700),row('future','2026-10-28',100)],[receipt(date,1500,[['old',700],['now',700],['future',100]])],date,'employee',true);expect(data).toMatchObject({target:700,previousOverdue:0,todayUnpaid:0,totalCollectible:0,remainingCollectible:0,collected:1500});});
test('old overdue without a due-today row remains collectible, and zero customers produces zeros',()=>{expect(calculate([row('old','2026-10-26',100)],[receipt('2026-10-26',100,[['old',100]])],date)).toMatchObject({target:0,totalCollectible:600,remainingCollectible:600,overdueInstallmentCount:1});expect(calculate([],[],date)).toMatchObject({totalCollectible:0,remainingCollectible:0});});

// Opening target is stable during a business day; receipt cash flow is independent.
test.each([
 ['today only',[row('now',date)],[],700,700,0],
 ['overdue and today',[row('old','2026-10-26'),row('now',date)],[],1400,1400,0],
 ['partial overdue',[row('old','2026-10-26',300),row('now',date)],[receipt(date,300,[['old',300]])],1400,1100,300],
 ['full overdue recovery',[row('old','2026-10-26',700),row('now',date)],[receipt(date,700,[['old',700]])],1400,700,700],
 ['overdue plus today',[row('old','2026-10-26',700),row('now',date,200)],[receipt(date,900,[['old',700],['now',200]])],1400,500,900],
 ['advance and unapplied receipt',[row('old','2026-10-26',700),row('now',date,700),row('future','2026-10-28',100)],[receipt(date,1600,[['old',700],['now',700],['future',100]])],1400,0,1600],
 ['earlier advance reduces opening',[row('now',date,100)],[receipt('2026-10-26',100,[['now',100]])],600,600,0],
 ['zero portfolio',[],[],0,0,0],
])('%s opening collectible and remaining use allocations, not total receipts',(_,schedules,payments,opening,remaining,actual)=>{
 const result=calculate(schedules,payments,date);expect(result).toMatchObject({openingCollectible:opening,remainingCollectible:remaining,collected:actual,collectibleHistoryKnown:true,collectibleBalanceKnown:true});expect(result.collectibleAllocatedOnDate).toBe(opening-remaining);
});
test('historical opening reconstructs receipt dates rather than current schedule balances',()=>{
 const schedules=[row('old','2026-10-25',700),row('now','2026-10-26',700)];
 const payments=[receipt('2026-10-25',100,[['old',100]]),receipt('2026-10-26',200,[['old',200]]),receipt(date,1100,[['old',400],['now',700]])];
 expect(calculate(schedules,payments,'2026-10-26')).toMatchObject({openingCollectible:1300,remainingCollectible:1100,collected:200});
});
test('undated legacy coverage never invents an opening target',()=>{expect(calculate([row('a',date,200)],[],date)).toMatchObject({openingCollectible:null,collectibleHistoryKnown:false});});
test('reversed receipt neither reduces opening or remaining nor adds customer cash',()=>{
 expect(calculate([row('a',date,700)],[{...receipt(date,700,[['a',700]]),status:'REVERSED'}],date)).toMatchObject({openingCollectible:700,remainingCollectible:700,collected:0});
});

test('same-day last-paid date cannot fabricate opening amounts for unmapped legacy partials',()=>{expect(calculate([{...row('a',date,200),paidDate:date}],[],date)).toMatchObject({openingCollectible:null,collectibleHistoryKnown:false});});
