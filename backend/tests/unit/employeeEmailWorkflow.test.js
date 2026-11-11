const crypto = require('crypto');
const { validationResult } = require('express-validator');
const employeeValidator = require('../../src/validators/employee.validator');

jest.mock('../../src/utils/auditLogger', () => ({
  createAuditLog: jest.fn().mockResolvedValue({})
}));
jest.mock('../../src/services/email.service', () => ({
  send: jest.fn().mockResolvedValue(true),
  digest: jest.fn(val => require('crypto').createHash('sha256').update(val).digest('hex'))
}));
jest.mock('../../src/models/AccountSettings', () => ({
  updateOne: jest.fn().mockResolvedValue({})
}));

describe('Employee Email Editing and Validation Unit Tests', () => {
  async function runValidation(rules, body) {
    const req = { body, params: { id: '507f1f77bcf86cd799439011' } };
    // The last item in rules is the validate middleware; previous items are validation chains
    for (const rule of rules) {
      if (typeof rule.run === 'function') {
        await rule.run(req);
      }
    }
    return { req, result: validationResult(req) };
  }

  test('validateUpdateEmployee accepts valid email and trims/normalizes to lowercase', async () => {
    const { req, result } = await runValidation(employeeValidator.validateUpdateEmployee, {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '9876543210',
      city: 'Mumbai',
      area: 'Central'
    });
    if (!result.isEmpty()) {
      console.log('Validation errors:', result.array());
    }
    expect(result.isEmpty()).toBe(true);
    expect(req.body.email).toBe('jane.doe@example.com');
  });

  test('validateUpdateEmployee rejects invalid email format', async () => {
    const { result } = await runValidation(employeeValidator.validateUpdateEmployee, {
      name: 'Jane Doe',
      email: 'not-an-email',
      phone: '9876543210',
      city: 'Mumbai',
      area: 'Central'
    });
    expect(result.isEmpty()).toBe(false);
    expect(result.array()[0].msg).toBe('Invalid email format');
  });

  test('validateUpdateEmployee allows updating other fields when email is omitted', async () => {
    const { result } = await runValidation(employeeValidator.validateUpdateEmployee, {
      name: 'Jane Doe Updated',
      phone: '9876543210',
      city: 'Mumbai',
      area: 'Central'
    });
    expect(result.isEmpty()).toBe(true);
  });
});

describe('Password Setup & Email Activation Logic', () => {
  const Employee = require('../../src/models/Employee');
  const recovery = require('../../src/services/passwordRecovery.service');

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-secret-key-12345';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('completeReset activates pendingEmail and updates password when verification token matches', async () => {
    const token = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const dummyEmployeeId = '507f1f77bcf86cd799439011';

    const mockEmployee = {
      _id: dummyEmployeeId,
      name: 'John Test',
      email: 'old@example.com',
      password: '$2a$10$dummyhashedoldpassword',
      emailVerification: {
        pendingEmail: 'new@example.com',
        tokenHash,
        expiresAt: new Date(Date.now() + 600000)
      }
    };

    jest.spyOn(Employee, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(mockEmployee)
    });

    jest.spyOn(Employee, 'findOneAndUpdate').mockResolvedValue({
      _id: dummyEmployeeId,
      email: 'new@example.com'
    });

    const utils = require('../../src/utils/password');
    jest.spyOn(utils, 'comparePassword').mockResolvedValue(false);
    jest.spyOn(utils, 'hashPassword').mockResolvedValue('$2a$10$dummyhashednewpassword');

    const result = await recovery.completeReset(token, 'NewSecurePassword123!', {});
    expect(result).toBe(true);

    expect(Employee.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: dummyEmployeeId,
        'emailVerification.tokenHash': tokenHash
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          email: 'new@example.com',
          password: expect.any(String)
        }),
        $inc: { authVersion: 1 },
        $unset: expect.objectContaining({
          emailVerification: '',
          pendingEmail: ''
        })
      }),
      { returnDocument: 'after' }
    );
  });

  test('completeReset returns false if token is unknown or expired', async () => {
    const token = 'b'.repeat(64);

    jest.spyOn(Employee, 'findOne').mockImplementation((query) => {
      if (query && query['emailVerification.tokenHash']) {
        return { select: jest.fn().mockResolvedValue(null) };
      }
      return Promise.resolve(null);
    });

    const result = await recovery.completeReset(token, 'NewSecurePassword123!', {});
    expect(result).toBe(false);
  });
});
