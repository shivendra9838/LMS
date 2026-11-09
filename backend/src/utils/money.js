const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };
const MAX_MINOR = 1000000000000;
function minor(value, allowZero = false) {
  const text = String(value ?? '');
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(text)) fail('Use a positive amount with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > MAX_MINOR || result < (allowZero ? 0 : 1)) fail('Amount is outside the supported range');
  return result;
}
const legacyMinor = value => {
  const result = Math.round(Number(value || 0) * 100);
  if (!Number.isSafeInteger(result) || result < 0 || result > MAX_MINOR) fail('Historical amount needs financial review');
  return result;
};
// MongoDB equivalent of legacyMinor for non-negative stored amounts, used by read-only summaries.
const mongoMinor = field => ({$floor:{$add:[{$multiply:[{$ifNull:[field,0]},100]},0.5]}});
module.exports = { minor, legacyMinor, major: value => value / 100, MAX_MINOR, mongoMinor };
