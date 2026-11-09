const crypto = require('crypto');

function key() {
  const value = process.env.KYC_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(value || '')) {
    throw Object.assign(new Error('KYC encryption is not configured. Set KYC_ENCRYPTION_KEY to a persistent 32-byte hex key.'), { status: 503 });
  }
  return Buffer.from(value, 'hex');
}
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]);
}
function decrypt(value) {
  const buffer = Buffer.from(value);
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(), buffer.subarray(0, 12));
  cipher.setAuthTag(buffer.subarray(-16));
  return Buffer.concat([cipher.update(buffer.subarray(12, -16)), cipher.final()]);
}
module.exports = { encrypt, decrypt };
