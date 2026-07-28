require('dotenv').config({ path: `${__dirname}/.env` });
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const assert = require('assert');
const app = require('./src/app');
const Admin = require('./src/models/Admin');
const Branch = require('./src/models/Branch');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const { generateToken } = require('./src/utils/jwt');

async function testBranchManagement() {
  let server;
  const suffix = Date.now();
  const branchName = `Mumbai Branch ${suffix}`;
  const employeeEmail = `branch.employee.${suffix}@test.com`;
  const employeePhone = String(suffix).slice(-10).padStart(10, '9');
  const customerMobile = String(suffix).slice(-10).padStart(10, '8');

  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api`;

    console.log(`Server running on port ${port} for Branch Management testing`);

    const admin = await Admin.findOne();
    if (!admin) throw new Error('No admin user found');

    const adminToken = generateToken(admin._id, 'ADMIN');
    const api = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n--- Step 1: Create Branch ---');
    const branchRes = await api.post('/branches', {
      name: branchName,
      areas: ['Vashi', 'Nerul']
    });

    assert.strictEqual(branchRes.data.success, true);
    assert.strictEqual(branchRes.data.data.name, branchName);
    assert.deepStrictEqual(branchRes.data.data.areas, ['Vashi', 'Nerul']);
    console.log('PASS: Branch created with expected areas');

    const branchId = branchRes.data.data._id;

    console.log('\n--- Step 2: Create Employee Assigned to Branch Area ---');
    const employeeRes = await api.post('/employees', {
      name: 'Branch Test Employee',
      email: employeeEmail,
      phone: employeePhone,
      branchId,
      area: 'Vashi'
    });

    assert.strictEqual(employeeRes.data.success, true);
    const employee = await Employee.findOne({ email: employeeEmail });
    assert(employee, 'Employee should exist after API create');
    assert.strictEqual(employee.branchId.toString(), branchId);
    assert.strictEqual(employee.area, 'Vashi');
    assert.strictEqual(employee.city, branchName);
    console.log('PASS: Employee inherited legacy city from branch and kept selected area');

    console.log('\n--- Step 3: Create Customer Assigned to Employee ---');
    const customerRes = await api.post('/customers', {
      employeeId: employee._id,
      name: 'Branch Test Customer',
      fatherName: 'Test Father',
      mobile: customerMobile,
      age: 31,
      gender: 'Male',
      occupation: 'Business',
      address: 'Test Address'
    });

    assert.strictEqual(customerRes.data.success, true);
    const customer = await Customer.findOne({ mobile: customerMobile });
    assert(customer, 'Customer should exist after API create');
    assert.strictEqual(customer.employeeId.toString(), employee._id.toString());
    assert.strictEqual(customer.branchId.toString(), branchId);
    assert.strictEqual(customer.area, 'Vashi');
    assert.strictEqual(customer.city, branchName);
    console.log('PASS: Customer automatically inherited employee branch and area');

    console.log('\n--- Step 4: Fetch Branches as Employee ---');
    const employeeToken = generateToken(employee._id, 'EMPLOYEE');
    const employeeApi = axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${employeeToken}` }
    });

    const listRes = await employeeApi.get('/branches');
    assert.strictEqual(listRes.data.success, true);
    assert(listRes.data.data.some(branch => branch._id === branchId));
    console.log('PASS: Employee can fetch branch list');

    console.log('\nAll Branch Management tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nBranch Management Test Error:', err.response?.data || err.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await Customer.deleteMany({ mobile: customerMobile });
      await Employee.deleteMany({ email: employeeEmail });
      await Branch.deleteMany({ name: branchName });
    }
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('\nBranch Management tests finished.');
  }
}

testBranchManagement();
