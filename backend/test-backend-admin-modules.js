require('dotenv').config({ path: `${__dirname}/.env` });
const http = require('http');
const mongoose = require('mongoose');
const axios = require('axios');
const assert = require('assert');
const app = require('./src/app');
const Admin = require('./src/models/Admin');
const AuditLog = require('./src/models/AuditLog');
const CashBook = require('./src/models/CashBook');
const Expense = require('./src/models/Expense');
const { generateToken } = require('./src/utils/jwt');

async function testBackendAdminModules() {
  let server;
  const testDate = new Date('2099-01-15T00:00:00.000Z');
  const suffix = Date.now();
  let expenseId;

  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    await CashBook.deleteOne({ date: testDate });
    await Expense.deleteMany({ description: new RegExp(`Backend Test ${suffix}`) });

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

    console.log('\n=== Cash Book Tests ===');
    await api.post('/cash-book/opening-balance', {
      date: testDate,
      openingBalance: 10000
    });

    await api.post('/cash-book/manual-entry', {
      date: testDate,
      type: 'MANUAL_INCOME',
      amount: 2000,
      description: `Backend Test ${suffix} Manual Income`
    });

    await api.post('/cash-book/manual-entry', {
      date: testDate,
      type: 'MISC',
      amount: 500,
      description: `Backend Test ${suffix} Misc Cash Out`
    });

    let cashRes = await api.get('/cash-book/2099-01-15');
    assert.strictEqual(cashRes.data.data.openingBalance, 10000);
    assert.strictEqual(cashRes.data.data.cashIn, 2000);
    assert.strictEqual(cashRes.data.data.cashOut, 500);
    assert.strictEqual(cashRes.data.data.closingBalance, 11500);
    console.log('PASS: Opening Balance, Cash In, Cash Out, Closing Balance');

    console.log('\n=== Expense Tests ===');
    const addExpenseRes = await api.post('/expenses', {
      date: testDate,
      category: 'OFFICE_EXPENSE',
      amount: 700,
      description: `Backend Test ${suffix} Office Expense`,
      paidTo: 'Stationery Vendor',
      paymentMode: 'CASH'
    });

    assert.strictEqual(addExpenseRes.data.success, true);
    expenseId = addExpenseRes.data.data._id;
    console.log('PASS: Expense Add');

    const updateExpenseRes = await api.put(`/expenses/${expenseId}`, {
      amount: 900,
      description: `Backend Test ${suffix} Office Expense Updated`
    });
    assert.strictEqual(updateExpenseRes.data.data.amount, 900);
    console.log('PASS: Expense Update');

    const reportRes = await api.get('/expenses/report?from=2099-01-15&to=2099-01-15');
    assert(reportRes.data.data.totalAmount >= 900);
    assert(reportRes.data.data.data.some(item => item.category === 'OFFICE_EXPENSE' && item.totalAmount >= 900));
    console.log('PASS: Expense Report');

    cashRes = await api.get('/cash-book/2099-01-15');
    assert.strictEqual(cashRes.data.data.cashOut, 1400);
    assert.strictEqual(cashRes.data.data.closingBalance, 10600);
    console.log('PASS: Expense synced to Cash Book Cash Out');

    const deleteExpenseRes = await api.delete(`/expenses/${expenseId}`);
    assert.strictEqual(deleteExpenseRes.data.data.status, 'DELETED');
    console.log('PASS: Expense Delete');

    cashRes = await api.get('/cash-book/2099-01-15');
    assert.strictEqual(cashRes.data.data.cashOut, 500);
    assert.strictEqual(cashRes.data.data.closingBalance, 11500);
    console.log('PASS: Deleted expense removed from Cash Book');

    console.log('\n=== Audit Tests ===');
    await new Promise(resolve => setTimeout(resolve, 500));

    const createdLog = await AuditLog.findOne({ action: 'EXPENSE_CREATED', referenceId: expenseId.toString() });
    const updatedLog = await AuditLog.findOne({ action: 'EXPENSE_UPDATED', referenceId: expenseId.toString() });
    const deletedLog = await AuditLog.findOne({ action: 'EXPENSE_DELETED', referenceId: expenseId.toString() });

    assert(createdLog, 'EXPENSE_CREATED audit log should exist');
    assert(updatedLog, 'EXPENSE_UPDATED audit log should exist');
    assert(deletedLog, 'EXPENSE_DELETED audit log should exist');
    console.log('PASS: Audit Create, Update, Delete');

    const auditSearchRes = await api.get('/audit-logs?search=EXPENSE&module=EXPENSE');
    assert.strictEqual(auditSearchRes.data.success, true);
    assert(auditSearchRes.data.data.length >= 3);
    console.log('PASS: Audit Search');

    console.log('\nAll backend admin module tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nBackend Admin Module Test Error:', err.response?.data || err.message);
  } finally {
    if (expenseId) {
      await AuditLog.deleteMany({ referenceId: expenseId.toString() }).catch(() => {});
    }
    if (mongoose.connection.readyState === 1) {
      await CashBook.deleteOne({ date: testDate });
      await Expense.deleteMany({ description: new RegExp(`Backend Test ${suffix}`) });
    }
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('\nBackend admin module tests finished.');
  }
}

testBackendAdminModules();
