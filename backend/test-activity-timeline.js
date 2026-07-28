require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const app = require('./src/app');
const Admin = require('./src/models/Admin');
const Customer = require('./src/models/Customer');
const Employee = require('./src/models/Employee');
const ActivityTimeline = require('./src/models/ActivityTimeline');
const { generateToken } = require('./src/utils/jwt');
const { recordActivity } = require('./src/utils/activityLogger');

async function testActivityTimeline() {
  let server;
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api`;

    console.log(`Server running on port ${port} for Activity Timeline testing`);

    const admin = await Admin.findOne();
    if (!admin) throw new Error('No admin user found');

    const customer = await Customer.findOne();
    if (!customer) throw new Error('No customer found');

    const employee = await Employee.findOne();
    if (!employee) throw new Error('No employee found');

    const adminToken = generateToken(admin._id, 'ADMIN');
    const api = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n--- Step 1: Record Simulated Customer Timeline Lifecycle ---');
    
    // 1. Customer Created
    await recordActivity({
      entityType: 'CUSTOMER',
      entityId: customer._id,
      action: 'CUSTOMER_CREATED',
      description: 'Customer Created in system',
      performedBy: admin._id,
      performerModel: 'Admin'
    });

    // 2. Loan Created
    await recordActivity({
      entityType: 'CUSTOMER',
      entityId: customer._id,
      action: 'LOAN_CREATED',
      description: 'Loan #LN-TEST-01 Created',
      performedBy: admin._id,
      performerModel: 'Admin'
    });

    // 3. Day 1 Paid
    await recordActivity({
      entityType: 'CUSTOMER',
      entityId: customer._id,
      action: 'DAY_PAID',
      description: 'Day 1 Paid (Amount ₹110)',
      performedBy: employee._id,
      performerModel: 'Employee'
    });

    // 4. Day 2 Missed
    await recordActivity({
      entityType: 'CUSTOMER',
      entityId: customer._id,
      action: 'DAY_MISSED',
      description: 'Day 2 Missed',
      performedBy: employee._id,
      performerModel: 'Employee'
    });

    // 5. Loan Closed
    await recordActivity({
      entityType: 'CUSTOMER',
      entityId: customer._id,
      action: 'LOAN_CLOSED',
      description: 'Loan #LN-TEST-01 Closed',
      performedBy: admin._id,
      performerModel: 'Admin'
    });

    console.log('✅ Recorded 5 lifecycle events for Customer');

    console.log('\n--- Step 2: Record Employee & Admin Timelines ---');
    await recordActivity({
      entityType: 'EMPLOYEE',
      entityId: employee._id,
      action: 'COLLECTED_PAYMENT',
      description: 'Collected ₹110 payment from customer',
      performedBy: employee._id,
      performerModel: 'Employee'
    });

    await recordActivity({
      entityType: 'ADMIN',
      entityId: admin._id,
      action: 'REPORT_EXPORTED',
      description: 'Exported Daily Collection Report to Excel',
      performedBy: admin._id,
      performerModel: 'Admin'
    });
    console.log('✅ Recorded Employee and Admin activity events');

    console.log('\n--- Step 3: Test GET /api/timeline/customer/:id ---');
    const custRes = await api.get(`/timeline/customer/${customer._id}`);
    if (custRes.data.success && custRes.data.data.length >= 5) {
      console.log(`✅ PASS: GET /api/timeline/customer/:id returned ${custRes.data.data.length} chronological events!`);
      const actions = custRes.data.data.map(item => item.action).reverse();
      console.log(`Timeline Order: ${actions.join(' -> ')}`);
    } else {
      console.log('❌ FAIL: GET /api/timeline/customer/:id failed or incomplete');
    }

    console.log('\n--- Step 4: Test GET /api/timeline/employee/:id ---');
    const empRes = await api.get(`/timeline/employee/${employee._id}`);
    if (empRes.data.success && empRes.data.data.length > 0) {
      console.log(`✅ PASS: GET /api/timeline/employee/:id returned ${empRes.data.data.length} employee activity events`);
    } else {
      console.log('❌ FAIL: GET /api/timeline/employee/:id failed');
    }

    console.log('\n--- Step 5: Test GET /api/timeline/admin ---');
    const adminRes = await api.get('/timeline/admin');
    if (adminRes.data.success && adminRes.data.data.length > 0) {
      console.log(`✅ PASS: GET /api/timeline/admin returned ${adminRes.data.data.length} admin activity events`);
    } else {
      console.log('❌ FAIL: GET /api/timeline/admin failed');
    }

  } catch (err) {
    console.error('Activity Timeline Test Error:', err.response?.data || err.message);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    console.log('\nActivity Timeline tests finished.');
  }
}

testActivityTimeline();
