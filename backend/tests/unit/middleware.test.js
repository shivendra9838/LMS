const { authorizeRoles } = require('../../src/middlewares/role.middleware');
const { authenticate } = require('../../src/middlewares/auth.middleware');
const { generateToken } = require('../../src/utils/jwt');
jest.mock('../../src/models/Admin',()=>({findById:jest.fn(()=>({select:jest.fn().mockResolvedValue({isActive:true,authVersion:0})}))}));

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Permission Middleware', () => {
  test('allows permitted roles', () => {
    const req = { user: { role: 'ADMIN' } };
    const res = mockResponse();
    const next = jest.fn();

    authorizeRoles('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks forbidden roles', () => {
    const req = { user: { role: 'EMPLOYEE' } };
    const res = mockResponse();
    const next = jest.fn();

    authorizeRoles('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden', errors: [] });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Auth Middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  test('authenticates bearer tokens', async () => {
    const token = generateToken('user-1', 'ADMIN');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user.id).toBe('user-1');
    expect(req.user.role).toBe('ADMIN');
    expect(next).toHaveBeenCalled();
  });

  test('rejects missing tokens', () => {
    const req = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
