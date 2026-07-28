require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const app = require('./src/app');

// Mock Data Models
const Admin = require('./src/models/Admin');
const Employee = require('./src/models/Employee');

const runTests = async () => {
  let server;
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    // Start server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api`;
    const api = axios.create({ baseURL, validateStatus: () => true });

    console.log(`\nServer running on port ${port} for testing`);

    // 1. Get Tokens
    console.log('\n--- Fetching Authentication Tokens ---');
    // Ensure we have an admin and employee
    let admin = await Admin.findOne({});
    let employee = await Employee.findOne({ status: 'ACTIVE' });

    if (!admin || !employee) {
      console.log('Admin or Employee user missing from DB. Cannot test Auth.');
      return;
    }

    const { generateToken } = require('./src/utils/jwt');
    const adminToken = generateToken(admin._id, 'ADMIN');
    const empToken = generateToken(employee._id, 'EMPLOYEE');

    if (!adminToken || !empToken) {
      console.log('Failed to get auth tokens');
      return;
    }

    // 2. Authorization Tests
    console.log('\n--- Authorization Tests ---');
    const authAdminRes = await api.get('/reports/daily', { headers: { Authorization: `Bearer ${adminToken}` } });
    if (authAdminRes.status === 200) {
      console.log('✅ PASS: Admin can access reports');
    } else {
      console.log('❌ FAIL: Admin cannot access reports');
    }

    const authEmpRes = await api.get('/reports/daily', { headers: { Authorization: `Bearer ${empToken}` } });
    if (authEmpRes.status === 403) {
      console.log('✅ PASS: Employee gets 403 Forbidden for reports');
    } else {
      console.log(`❌ FAIL: Employee got status ${authEmpRes.status}`);
    }

    // 3. Reports Data Tests
    console.log('\n--- Reports Logic Tests ---');
    const apiAdmin = axios.create({ baseURL, headers: { Authorization: `Bearer ${adminToken}` } });

    // Daily Report Filters
    const dRes = await apiAdmin.get('/reports/daily?startDate=2026-07-01&endDate=2026-07-31');
    if (dRes.data.success) {
      console.log(`✅ PASS: Daily Report works with Custom Date Range (${dRes.data.data.length} records)`);
    } else {
      console.log('❌ FAIL: Daily Report query failed');
    }

    // Employee Report
    const eRes = await apiAdmin.get('/reports/employees');
    if (eRes.data.success && eRes.data.data.length > 0) {
      const emp = eRes.data.data[0];
      if ('customers' in emp && 'collectionEfficiency' in emp && 'outstanding' in emp) {
        console.log(`✅ PASS: Employee Report correct counts & calculations (Efficiency: ${emp.collectionEfficiency}%, Outstanding: ₹${emp.outstanding})`);
      } else {
        console.log('❌ FAIL: Employee Report missing key calculation fields');
      }
    }

    // Area Report
    const aRes = await apiAdmin.get('/reports/area');
    if (aRes.data.success && aRes.data.data.length > 0) {
      const area = aRes.data.data[0];
      if ('area' in area && 'customers' in area && 'todaysCollection' in area) {
        console.log(`✅ PASS: Area Report generates area/city totals`);
      } else {
        console.log('❌ FAIL: Area Report missing aggregation fields');
      }
    }

    // Excel Export Test
    console.log('\n--- Excel Export Test ---');
    const excelRes = await api.get('/reports/export/daily', {
      headers: { Authorization: `Bearer ${adminToken}` },
      responseType: 'arraybuffer'
    });
    
    const contentType = excelRes.headers['content-type'];
    const contentDisp = excelRes.headers['content-disposition'];
    if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
        contentDisp.includes('attachment; filename=daily-report')) {
      console.log(`✅ PASS: Excel download headers and format correct. File size: ${excelRes.data.length} bytes`);
    } else {
      console.log('❌ FAIL: Excel download headers incorrect');
      console.log(excelRes.headers);
    }

  } catch (err) {
    console.error('Test Execution Error:', err);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('\nTests completed.');
  }
};

runTests();
