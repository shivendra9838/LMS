const {businessDay,dayStart,addDays,bounds}=require('../../src/utils/businessDay');
const {calculateLoanDetails,installmentAmounts}=require('../../src/utils/loanCalculator');
const {legacyMinor}=require('../../src/utils/money');
describe('IST financial days and exact schedules',()=>{
 test('India midnight boundaries do not depend on the server timezone',()=>{
  expect(businessDay('2026-07-29T18:29:59.999Z')).toBe('2026-07-29');expect(businessDay('2026-07-29T18:30:00Z')).toBe('2026-07-30');
  expect(dayStart('2026-07-30').toISOString()).toBe('2026-07-29T18:30:00.000Z');expect(bounds('2026-07-30').end.toISOString()).toBe('2026-07-30T18:30:00.000Z');
  expect(addDays('2028-02-28',1)).toBe('2028-02-29');expect(()=>dayStart('2026-02-30')).toThrow();
 });
 test.each([[100000,7,120],[9999,2.5,30],[1,0,100],[2000,3,30]])('scheduled paise reconcile exactly for %s at %s over %s days',(amount,rate,days)=>{
  const result=calculateLoanDetails(String(amount),String(rate),String(days)),amounts=installmentAmounts(result.totalPayable,days);
  expect(amounts).toHaveLength(days);expect(amounts.every(n=>n>0)).toBe(true);expect(amounts.reduce((sum,value)=>sum+legacyMinor(value),0)).toBe(legacyMinor(result.totalPayable));
 });
 test('invalid amounts, rates and unsupported durations fail clearly',()=>{
  expect(()=>calculateLoanDetails('10.001',5,30)).toThrow();expect(()=>calculateLoanDetails(100,NaN,30)).toThrow();expect(()=>calculateLoanDetails(100,5,0)).toThrow();
 });
});
