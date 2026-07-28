require('dotenv').config({ path: `${__dirname}/.env` });
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const assert = require('assert');
const app = require('./src/app');
const Admin = require('./src/models/Admin');
const { generateToken } = require('./src/utils/jwt');

async function testSystemHealth() {
  let server;

  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api`;

    const admin = await Admin.findOne();
    if (!admin) throw new Error('No admin user found');

    const adminToken = generateToken(admin._id, 'ADMIN');
    const api = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n--- Step 1: Trigger Successful and Failed API Requests ---');
    await axios.get(`${baseURL}/health`);
    try {
      await axios.get(`${baseURL}/missing-health-test`);
    } catch (error) {
      assert.strictEqual(error.response.status, 404);
    }
    console.log('PASS: Request metrics have traffic to count');

    console.log('\n--- Step 2: Fetch Admin System Health Dashboard ---');
    const res = await api.get('/system-health');
    const data = res.data.data;

    assert.strictEqual(res.data.success, true);
    assert.strictEqual(data.databaseConnected, true);
    assert.strictEqual(data.serverRunning, true);
    assert(data.totalApiRequestsToday >= 3);
    assert(data.failedRequests >= 1);
    assert(data.storageUsage);
    assert(data.applicationVersion);
    assert(Object.prototype.hasOwnProperty.call(data, 'lastBackupTime'));
    console.log('PASS: System health dashboard returned all required cards');

    console.log('\nAll System Health tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nSystem Health Test Error:', err.response?.data || err.message);
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('\nSystem Health tests finished.');
  }
}

testSystemHealth();
