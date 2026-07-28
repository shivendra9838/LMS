const express = require('express');
const request = require('supertest');
const { validateLogin } = require('../../src/validators/auth.validator');
const { validateCreateLoan } = require('../../src/validators/loan.validator');
const { validateCreateEmployee } = require('../../src/validators/employee.validator');
const responseFormatter = require('../../src/middlewares/response.middleware');

const buildApp = (validator) => {
  const app = express();
  app.use(express.json());
  app.use(responseFormatter);
  app.post('/test', validator, (req, res) => res.status(200).json({ success: true, data: req.body }));
  return app;
};

describe('Validation Layer', () => {
  test('validates email format', async () => {
    const res = await request(buildApp(validateLogin))
      .post('/test')
      .send({ email: 'bad-email', password: 'secret' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors[0].msg).toBe('Invalid email format');
  });

  test('validates phone format', async () => {
    const res = await request(buildApp(validateCreateEmployee))
      .post('/test')
      .send({ name: 'Test', email: 'test@example.com', phone: '123', city: 'Mumbai', area: 'Vashi' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some(error => error.msg === 'Invalid phone format')).toBe(true);
  });

  test('validates loan amount, interest, and duration', async () => {
    const res = await request(buildApp(validateCreateLoan))
      .post('/test')
      .send({
        customerId: '507f1f77bcf86cd799439011',
        loanAmount: 0,
        interestPercent: 0,
        durationDays: 0,
        loanDate: '2026-07-28'
      });

    expect(res.status).toBe(400);
    expect(res.body.errors.map(error => error.msg)).toEqual(expect.arrayContaining([
      'Loan Amount must be greater than 0',
      'Interest must be greater than 0',
      'Duration must be greater than 0'
    ]));
  });
});
