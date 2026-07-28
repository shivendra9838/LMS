require('dotenv').config({ path: `${__dirname}/.env` });
const mongoose = require('mongoose');
const assert = require('assert');
const CashBook = require('./src/models/CashBook');
const {
  recordCashBookEntry,
  setOpeningBalanceService,
  getCashBookDayService,
  getCashBookDashboardService
} = require('./src/services/cashBook.service');

async function testCashBook() {
  const testDate = new Date();
  testDate.setHours(0, 0, 0, 0);

  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);

    await CashBook.deleteOne({ date: testDate });

    console.log('\n--- Step 1: Set Opening Balance ---');
    await setOpeningBalanceService(testDate, 10000);
    let dayBook = await getCashBookDayService(testDate);
    assert.strictEqual(dayBook.openingBalance, 10000);
    assert.strictEqual(dayBook.closingBalance, 10000);
    console.log('PASS: Opening balance set');

    console.log('\n--- Step 2: Record Loan Given ---');
    await recordCashBookEntry({
      date: testDate,
      type: 'NEW_LOAN',
      direction: 'CASH_OUT',
      cashOut: 2500,
      description: 'Test loan given',
      referenceModel: 'Manual',
      referenceId: new mongoose.Types.ObjectId()
    });
    dayBook = await getCashBookDayService(testDate);
    assert.strictEqual(dayBook.cashOut, 2500);
    assert.strictEqual(dayBook.closingBalance, 7500);
    console.log('PASS: Loan given reduced cash');

    console.log('\n--- Step 3: Record Collection Received ---');
    await recordCashBookEntry({
      date: testDate,
      type: 'LOAN_RECOVERY',
      direction: 'CASH_IN',
      cashIn: 1200,
      description: 'Test collection received',
      referenceModel: 'Manual',
      referenceId: new mongoose.Types.ObjectId()
    });
    dayBook = await getCashBookDayService(testDate);
    assert.strictEqual(dayBook.cashIn, 1200);
    assert.strictEqual(dayBook.cashOut, 2500);
    assert.strictEqual(dayBook.closingBalance, 8700);
    console.log('PASS: Collection received increased cash');

    console.log('\n--- Step 4: Dashboard Summary ---');
    const dashboard = await getCashBookDashboardService();
    assert.strictEqual(dashboard.cashIn, 1200);
    assert.strictEqual(dashboard.cashOut, 2500);
    assert.strictEqual(dashboard.closingBalance, 8700);
    console.log('PASS: Dashboard summary matched today cash book');

    console.log('\nAll Cash Book tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nCash Book Test Error:', err.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await CashBook.deleteOne({ date: testDate });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('\nCash Book tests finished.');
  }
}

testCashBook();
