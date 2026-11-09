const { encrypt, decrypt } = require('../../src/utils/kycCrypto');
const { validateKyc } = require('../../src/validators/kyc.validator');

describe('KYC protection and validation', () => {
  beforeEach(() => { process.env.KYC_ENCRYPTION_KEY = '17'.repeat(32); });
  test('encrypts personal information with fresh authenticated nonces', () => {
    const bytes = Buffer.from('Aadhaar 234567890123');
    const a = encrypt(bytes); const b = encrypt(bytes);
    expect(a.equals(b)).toBe(false);
    expect(a.includes(bytes)).toBe(false);
    expect(decrypt(a)).toEqual(bytes);
    a[15] ^= 1;
    expect(() => decrypt(a)).toThrow();
  });
  test('fails closed when encryption key is missing', () => {
    delete process.env.KYC_ENCRYPTION_KEY;
    expect(() => encrypt(Buffer.from('private'))).toThrow('KYC encryption is not configured');
  });
  test('permits incomplete drafts but rejects invalid supplied data', () => {
    expect(validateKyc({ name: 'Draft' }).name).toBe('Draft');
    expect(validateKyc({ requestedAmount: '10000.50' }).requestedAmount).toBe('10000.50');
    expect(() => validateKyc({ requestedAmount: '1.234', tenure: '1.5' })).toThrow();
    expect(() => validateKyc({ mobile: 'invalid', pin: 'x', accountNumber: 'abc' })).toThrow();
    expect(() => validateKyc({ name: { $gt: '' } })).toThrow();
  });
  test('requires complete submission, valid age, identity, and declaration', () => {
    expect(() => validateKyc({}, true)).toThrow();
    expect(() => validateKyc({ dob: '2020-01-01' })).toThrow();
    expect(() => validateKyc({ dob: '1990-02-31' })).toThrow();
    expect(() => validateKyc({ idProofType: 'Aadhar', idProofNumber: '123' })).toThrow();
    expect(() => validateKyc({ ifsc: 'invalid' })).toThrow();
    expect(() => validateKyc({ declarationAccepted: 'false' })).toThrow();
  });
  test('whitelists fields and does not accept workflow fields from input', () => {
    const data = validateKyc({ name: 'Example', status: 'APPROVED', customerId: 'other', __proto__: { admin: true } });
    expect(data.status).toBeUndefined(); expect(data.customerId).toBeUndefined(); expect(data.admin).toBeUndefined();
  });
});
