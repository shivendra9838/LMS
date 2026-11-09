const mongoose = require('mongoose');
const request = require('supertest');
const crypto = require('crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ logAccess: jest.fn(), logError: jest.fn(), accessLoggerMiddleware: (req,res,next) => next() }));
jest.mock('../../src/utils/cache', () => ({ getCache: jest.fn(), setCache: jest.fn(), invalidateCache: jest.fn() }));
const nodemailer = require('nodemailer');
const Employee = require('../../src/models/Employee');
const Admin = require('../../src/models/Admin');
const AuditLog = require('../../src/models/AuditLog');
const recovery = require('../../src/services/passwordRecovery.service');
const { generateToken } = require('../../src/utils/jwt');
const app = require('../../src/app');
jest.setTimeout(120000);
let mongo, employee, admin, delivered, oldToken;
const sendMail = jest.fn(async message => { delivered = message; return { accepted: [message.to] }; });
const close = jest.fn();
const tokenFromMail = () => new URL(delivered.text.match(/http[^\s]+/)[0]).hash.slice(7);
const freshLink = async () => {
  await Employee.updateOne({ _id: employee._id }, { $unset: { passwordReset: '' } });
  await recovery.requestReset(employee.email, {});
  return tokenFromMail();
};
const reset = (token, password = 'NewSecurePassword123!') => request(app).post('/api/v1/auth/employee/reset-password').send({token, password, confirmPassword:password});

beforeAll(async () => {
  process.env.JWT_SECRET = 'password-recovery-isolated-test';
  Object.assign(process.env, { GMAIL_USER:'sender@example.test', GMAIL_APP_PASSWORD:'abcdefghijklmnop', FRONTEND_URL:'https://portal.example.test' });
  nodemailer.createTransport.mockReturnValue({ sendMail, close });
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {dbName:'isolated_password_recovery'});
  admin = await Admin.create({name:'Synthetic Admin',email:'recovery-admin@example.test',password:'OriginalPassword123!',phone:'9000000000'});
  employee = await Employee.create({name:'Synthetic Employee',employeeCode:'EMP0099',email:'recovery-employee@example.test',password:'OriginalPassword123!',phone:'9000000001',city:'Test',area:'Test',createdBy:admin._id});
  oldToken = generateToken(employee._id, 'EMPLOYEE');
});
afterAll(async () => { await mongoose.disconnect(); if(mongo)await mongo.stop(); });

test('unconfigured email returns an honest unavailable response', async () => {
  const saved = process.env.GMAIL_APP_PASSWORD; delete process.env.GMAIL_APP_PASSWORD;
  const response = await request(app).post('/api/v1/auth/employee/forgot-password').send({email:employee.email});
  expect(response.status).toBe(503); expect(response.body.message).toMatch(/not configured/);
  process.env.GMAIL_APP_PASSWORD = saved;
});

test('email tokens are hashed, private, expiring, use trusted fragment URL and respect cooldown', async () => {
  await recovery.requestReset(employee.email, {});
  const token = tokenFromMail();
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(delivered.text).toContain('https://portal.example.test/employee/reset-password#token=');
  const hidden = await Employee.findById(employee._id).lean();
  expect(hidden.passwordReset).toBeUndefined(); expect(hidden.authVersion).toBeUndefined();
  const stored = await Employee.findById(employee._id).select('+passwordReset');
  expect(stored.passwordReset.tokenHash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
  expect(stored.passwordReset.expiresAt.getTime()).toBeGreaterThan(Date.now());
  const count = sendMail.mock.calls.length;
  await recovery.requestReset(employee.email, {}); expect(sendMail).toHaveBeenCalledTimes(count);
});

test('unknown/admin/inactive addresses do not send employee recovery emails; API answers generically', async () => {
  const count = sendMail.mock.calls.length;
  await recovery.requestReset('missing@example.test', {}); await recovery.requestReset(admin.email, {});
  await Employee.updateOne({_id:employee._id},{$set:{status:'INACTIVE'}});
  await recovery.requestReset(employee.email, {});
  await Employee.updateOne({_id:employee._id},{$set:{status:'ACTIVE'}});
  expect(sendMail).toHaveBeenCalledTimes(count);
  const known = await request(app).post('/api/v1/auth/employee/forgot-password').send({email:employee.email});
  const unknown = await request(app).post('/api/v1/auth/employee/forgot-password').send({email:'missing@example.test'});
  expect(known.status).toBe(202); expect(unknown.body).toEqual(known.body);
});

test('email delivery failure invalidates that reset token without exposing credentials', async () => {
  await Employee.updateOne({_id:employee._id},{$unset:{passwordReset:''}});
  sendMail.mockRejectedValueOnce(new Error('private details'));
  await expect(recovery.requestReset(employee.email, {})).rejects.toThrow('RESET_EMAIL_DELIVERY_FAILED');
  const stored = await Employee.findById(employee._id).select('+passwordReset');
  expect(stored.passwordReset.tokenHash).toBeUndefined();
});

test('weak passwords, mismatched confirmation, malformed and expired tokens fail', async () => {
  const token = await freshLink();
  const weak = await reset(token,'weak');
  expect(weak.status).toBe(400);
  expect(weak.body.errors.every(error => error.value === undefined)).toBe(true);
  expect((await request(app).post('/api/v1/auth/employee/reset-password').send({token,password:'NewSecurePassword123!',confirmPassword:'different'})).status).toBe(400);
  expect((await reset('invalid')).status).toBe(400);
  await Employee.updateOne({_id:employee._id},{$set:{'passwordReset.expiresAt':new Date(0)}});
  expect((await reset(token)).status).toBe(400);
});

test('a newer link invalidates older links; disabled employees cannot reset', async () => {
  const old = await freshLink(); const latest = await freshLink();
  expect(await recovery.completeReset(old,'AnotherPassword123!',{})).toBe(false);
  await Employee.updateOne({_id:employee._id},{$set:{status:'INACTIVE'}});
  expect(await recovery.completeReset(latest,'AnotherPassword123!',{})).toBe(false);
  await Employee.updateOne({_id:employee._id},{$set:{status:'ACTIVE'}});
});

test('concurrent reset consumes the token once, revokes old sessions and preserves Admin credentials', async () => {
  const token = await freshLink();
  const results = await Promise.all([reset(token),reset(token)]);
  expect(results.map(r=>r.status).sort()).toEqual([200,400]);
  const reused = await recovery.completeReset(token,'AnotherPassword123!',{}); expect(reused).toBe(false);
  const oldLogin = await request(app).post('/api/v1/auth/login').send({email:employee.email,password:'OriginalPassword123!'});
  expect(oldLogin.status).toBe(401);
  const login = await request(app).post('/api/v1/auth/login').send({email:employee.email,password:'NewSecurePassword123!'});
  expect(login.status).toBe(200); expect(login.body.data.user.role).toBe('EMPLOYEE');
  expect((await request(app).get('/api/v1/auth/me').set('Authorization',`Bearer ${oldToken}`)).status).toBe(401);
  expect((await request(app).get('/api/v1/auth/me').set('Authorization',`Bearer ${login.body.data.token}`)).status).toBe(200);
  const adminLogin = await request(app).post('/api/v1/auth/login').send({email:admin.email,password:'OriginalPassword123!'});
  expect(adminLogin.status).toBe(200);
  const audit = await AuditLog.find({referenceId:String(employee._id)}).lean();
  expect(audit.some(row=>row.action==='EMPLOYEE_PASSWORD_RESET_COMPLETED')).toBe(true);
  expect(JSON.stringify(audit)).not.toContain(token);
});

test('local-only reset links are unavailable honestly without sending a broken development URL',async()=>{const origin=process.env.FRONTEND_URL;process.env.FRONTEND_URL='http://localhost:5173';const count=sendMail.mock.calls.length;try{const response=await request(app).post('/api/v1/auth/employee/forgot-password').send({email:employee.email});expect(response.status).toBe(503);expect(response.body.message).toMatch(/public HTTPS/);expect(sendMail).toHaveBeenCalledTimes(count);await expect(recovery.requestReset(employee.email,{})).rejects.toThrow('RECOVERY_NOT_CONFIGURED');}finally{process.env.FRONTEND_URL=origin;}});

test('recovery routes throttle repeated guesses', async () => {
  let response;
  for(let i=0;i<12;i++) response=await reset('invalid');
  expect(response.status).toBe(429);
});
