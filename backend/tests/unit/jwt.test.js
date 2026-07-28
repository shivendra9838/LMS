const { generateToken, verifyToken } = require('../../src/utils/jwt');

describe('JWT Utility', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  test('generates and verifies a token payload', () => {
    const token = generateToken('user-1', 'ADMIN');
    const decoded = verifyToken(token);

    expect(decoded.id).toBe('user-1');
    expect(decoded.role).toBe('ADMIN');
  });

  test('throws for invalid tokens', () => {
    expect(() => verifyToken('bad-token')).toThrow();
  });
});
