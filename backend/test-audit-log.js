require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const app = require('./src/app');
const Admin = require('./src/models/Admin');
const Customer = require('./src/models/Customer');
const AuditLog = require('./src/models/AuditLog');
const { generateToken } = require('./src/utils/jwt');

async function testAuditLog() {
  let server;
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api`;

    console.log(`Server running on port ${port} for Audit Log testing`);

    const admin = await Admin.findOne();
    if (!admin) throw new Error('No admin user found');

    const customer = await Customer.findOne();
    if (!customer) throw new Error('No customer found');

    const adminToken = generateToken(admin._id, 'ADMIN');
    const api = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n--- Step 1: Trigger Customer Update ---');
    const updatedName = `Audit Test Customer ${Date.now()}`;
    const updateRes = await api.put(`/customers/${customer._id}`, {
      name: updatedName
    });

    if (updateRes.data.success) {
      console.log('✅ Customer updated via API');
    } else {
      console.log('❌ Customer update failed');
    }

    // Give asynchronous non-blocking log creation a small 200ms tick to persist
    await new Promise(res => setTimeout(res, 200));

    console.log('\n--- Step 2: Verify Audit Log Creation in DB ---');
    const latestLog = await AuditLog.findOne({
      action: 'CUSTOMER_UPDATED',
      referenceId: customer._id.toString()
    }).sort({ createdAt: -1 });

    if (latestLog) {
      console.log('✅ PASS: Audit Log created in Database');
      console.log(`- Action: ${latestLog.action}`);
      console.log(`- Module: ${latestLog.module}`);
      console.log(`- User Role: ${latestLog.userRole}`);
      console.log(`- Old Name: ${latestLog.oldValue?.name}`);
      console.log(`- New Name: ${latestLog.newValue?.name}`);
    } else {
      console.log('❌ FAIL: Audit Log entry not found in Database');
    }

    console.log('\n--- Step 3: Test GET /api/audit-logs Endpoint ---');
    const logsRes = await api.get('/audit-logs?action=CUSTOMER_UPDATED&module=CUSTOMER');

    if (logsRes.data.success && logsRes.data.data.length > 0) {
      console.log(`✅ PASS: GET /api/audit-logs returned ${logsRes.data.data.length} logs with matching filters`);
    } else {
      console.log('❌ FAIL: GET /api/audit-logs returned empty or error');
    }

  } catch (err) {
    console.error('Audit Log Test Error:', err.response?.data || err.message);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    console.log('\nAudit Log tests finished.');
  }
}

testAuditLog();
