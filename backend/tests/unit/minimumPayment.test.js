const {minimumPayment,assertMinimum}=require('../../src/utils/minimumPayment');
const row=(date,amount,paidAmount=0)=>({date:date+'T00:00:00+05:30',amount,paidAmount});
test('today only, overdue plus today, partials and already allocated advances use paise',()=>{
 expect(minimumPayment([row('2026-11-04',181.67)],'2026-11-04T12:00:00Z')).toMatchObject({previousOverdue:0,todayUnpaid:181.67,minimumPayment:181.67});
 const summary=minimumPayment([row('2026-11-01',700,100),row('2026-11-03',400,91.65),row('2026-11-04',181.67),row('2026-11-05',700)],'2026-11-04T12:00:00Z');
 expect(summary).toMatchObject({previousOverdue:908.35,todayUnpaid:181.67,minimumPayment:1090.02});
 expect(()=>assertMinimum(109001,summary)).toThrow('Minimum payment required is ₹1,090.02. Please enter this amount or more.');
 expect(()=>assertMinimum(109002,summary)).not.toThrow();expect(()=>assertMinimum(120000,summary)).not.toThrow();
 expect(minimumPayment([row('2026-11-03',700,700),row('2026-11-04',700,100)],'2026-11-04T12:00:00Z').minimumPayment).toBe(600);
});
test('effective India date, not current date; future installments impose no minimum',()=>{
 const rows=[row('2026-11-03',700),row('2026-11-04',700)];
 expect(minimumPayment(rows,'2026-11-02T18:29:59Z').minimumPayment).toBe(0);
 expect(minimumPayment(rows,'2026-11-02T18:30:00Z').minimumPayment).toBe(700);
 expect(minimumPayment(rows,'2026-11-03T18:30:00Z').minimumPayment).toBe(1400);
 expect(()=>assertMinimum(1,minimumPayment(rows,'2026-11-01'))).not.toThrow();
});
