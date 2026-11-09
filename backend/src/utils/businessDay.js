const TIME_ZONE = 'Asia/Kolkata';
const fail = () => { throw Object.assign(new Error('Use a valid business date (YYYY-MM-DD)'), {status:422}); };
function businessDay(value = new Date()) {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) fail();
  return new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function dayStart(value = businessDay()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value+'T00:00:00Z')) || new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value) fail();
  return new Date(value+'T00:00:00+05:30');
}
function addDays(value, count) { const date=dayStart(value);date.setTime(date.getTime()+count*86400000);return businessDay(date); }
function bounds(value=businessDay()) { const start=dayStart(value);return {start,end:new Date(start.getTime()+86400000)}; }
module.exports={TIME_ZONE,businessDay,dayStart,addDays,bounds};
