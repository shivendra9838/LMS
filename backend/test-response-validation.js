require('dotenv').config({ path: `${__dirname}/.env` });
const http = require('http');
const axios = require('axios');
const assert = require('assert');
const app = require('./src/app');
const { generateToken } = require('./src/utils/jwt');

const assertSuccessShape = (body) => {
  assert.strictEqual(body.success, true);
  assert(Object.prototype.hasOwnProperty.call(body, 'message'));
  assert(Object.prototype.hasOwnProperty.call(body, 'data'));
  assert(Object.prototype.hasOwnProperty.call(body, 'meta'));
};

const assertErrorShape = (body) => {
  assert.strictEqual(body.success, false);
  assert(Object.prototype.hasOwnProperty.call(body, 'message'));
  assert(Array.isArray(body.errors));
};

async function testResponseAndValidation() {
  let server;

  try {
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api/v1`;
    const token = generateToken('507f1f77bcf86cd799439011', 'ADMIN');

    console.log('\n--- Step 1: Success response format ---');
    const healthRes = await axios.get(`${baseURL}/health`);
    assertSuccessShape(healthRes.data);
    console.log('PASS: Success response uses global format');

    console.log('\n--- Step 2: Error response format ---');
    try {
      await axios.get(`${baseURL}/route-that-does-not-exist`);
      throw new Error('Missing route should fail');
    } catch (error) {
      assert.strictEqual(error.response.status, 404);
      assertErrorShape(error.response.data);
    }
    console.log('PASS: Error response uses global format');

    console.log('\n--- Step 3: Validation rejects bad email ---');
    try {
      await axios.post(`${baseURL}/auth/login`, { email: 'bad-email', password: 'secret' });
      throw new Error('Invalid email should fail');
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
      assert.strictEqual(error.response.data.message, 'Validation failed');
      assertErrorShape(error.response.data);
    }
    console.log('PASS: Email validation returns 400');

    console.log('\n--- Step 4: Validation rejects bad phone ---');
    try {
      await axios.post(`${baseURL}/employees`, {
        name: 'Bad Phone Employee',
        email: 'badphone@example.com',
        phone: '123',
        city: 'Mumbai',
        area: 'Vashi'
      }, { headers: { Authorization: `Bearer ${token}` } });
      throw new Error('Invalid phone should fail');
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
      assertErrorShape(error.response.data);
    }
    console.log('PASS: Phone validation returns 400');

    console.log('\n--- Step 5: Validation rejects loan amount, interest, duration ---');
    try {
      await axios.post(`${baseURL}/loans`, {
        customerId: '507f1f77bcf86cd799439011',
        loanAmount: 0,
        interestPercent: 0,
        durationDays: 0,
        loanDate: '2026-07-28'
      }, { headers: { Authorization: `Bearer ${token}` } });
      throw new Error('Invalid loan input should fail');
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
      assertErrorShape(error.response.data);
    }
    console.log('PASS: Loan amount, interest, duration validation returns 400');

    console.log('\n--- Step 6: Validation rejects customer and employee codes ---');
    try {
      await axios.get(`${baseURL}/customers?customerCode=BAD&employee=BAD`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      throw new Error('Invalid codes should fail');
    } catch (error) {
      assert.strictEqual(error.response.status, 400);
      assertErrorShape(error.response.data);
    }
    console.log('PASS: Customer Code and Employee Code validation returns 400');

    console.log('\nGlobal response and validation tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nResponse/Validation Test Error:', err.response?.data || err.message);
  } finally {
    if (server) server.close();
    console.log('\nResponse/Validation tests finished.');
  }
}

testResponseAndValidation();
