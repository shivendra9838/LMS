const {dayStart,range}=require('../../src/services/reconciliation.service');
describe('Business-day reconciliation boundaries',()=>{
 const previous=process.env.SETTLEMENT_TIME_ZONE;
 beforeAll(()=>{process.env.SETTLEMENT_TIME_ZONE='Asia/Kolkata';});
 afterAll(()=>{if(previous===undefined)delete process.env.SETTLEMENT_TIME_ZONE;else process.env.SETTLEMENT_TIME_ZONE=previous;});
 test('uses the configured timezone rather than the server timezone',()=>{expect(dayStart('2026-10-23').toISOString()).toBe('2026-10-22T18:30:00.000Z');expect(range({from:'2026-10-23',to:'2026-10-23'}).end.toISOString()).toBe('2026-10-23T18:30:00.000Z');});
 test.each(['2026-02-30','2026-99-01','not-a-date'])('rejects invalid calendar day %s',value=>expect(()=>range({from:value})).toThrow());
});
