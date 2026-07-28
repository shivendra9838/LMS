const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('Password Utility', () => {
  test('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Secret123!');

    expect(hash).not.toBe('Secret123!');
    await expect(comparePassword('Secret123!', hash)).resolves.toBe(true);
    await expect(comparePassword('Wrong123!', hash)).resolves.toBe(false);
  });
});
