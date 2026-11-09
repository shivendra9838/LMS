const { businessDay, dayStart } = require('./businessDay');
const fail = message => {throw Object.assign(new Error(message),{status:422});};
function resolvePaymentDate(input, now = new Date()) {
  if (input === undefined) return new Date(now);
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) fail('Payment date must be YYYY-MM-DD in Asia/Kolkata');
  const date = dayStart(input);
  if (input > businessDay(now)) fail('A future payment cannot be marked received');
  return input === businessDay(now) ? new Date(now) : date;
}
function validateReceipt(date, loanDate, reason, now = new Date()) {
  if (businessDay(date) < businessDay(loanDate)) fail('Payment cannot precede the actual loan issue date');
  if (businessDay(date) < businessDay(now) && (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000)) fail('A backdated payment requires a reason of 5–1000 characters');
}
module.exports = {resolvePaymentDate,validateReceipt};
