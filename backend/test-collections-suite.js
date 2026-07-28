require('dotenv').config();
const mongoose = require('mongoose');
const { recordCollectionService } = require('./src/services/collection.service');
const { processMissedPayments } = require('./src/jobs/endOfDayCron');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');
const Collection = require('./src/models/Collection');
const Notification = require('./src/models/Notification');
const assert = require('assert');

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for Testing');

    const adminId = new mongoose.Types.ObjectId();
    const emp1 = await Employee.create({ employeeCode: 'EMP_TEST1', name: 'Emp 1', email: 'e1@logic.com', phone: '111', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const emp2 = await Employee.create({ employeeCode: 'EMP_TEST2', name: 'Emp 2', email: 'e2@logic.com', phone: '222', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    
    const user1 = { id: emp1._id.toString(), role: 'EMPLOYEE' };
    const user2 = { id: emp2._id.toString(), role: 'EMPLOYEE' };

    const cus = await Customer.create({ customerCode: 'CUS_TEST1', name: 'Cus 1', fatherName: 'F', mobile: '333', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp1._id });
    
    // Create base loan
    const createLoan = async () => {
      const loan = await Loan.create({ loanNumber: `LN_${Date.now()}`, customerId: cus._id, employeeId: emp1._id, loanAmount: 1000, interestPercent: 10, interestAmount: 100, totalPayable: 1100, dailyInstallment: 100, durationDays: 11, remainingAmount: 1100, remainingDays: 11, paidAmount: 0, paidDays: 0, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
      const sch1 = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 100, date: new Date(), status: 'PENDING' });
      const sch2 = await LoanSchedule.create({ loanId: loan._id, dayNumber: 2, amount: 100, date: new Date(Date.now() + 86400000), status: 'PENDING' });
      const sch3 = await LoanSchedule.create({ loanId: loan._id, dayNumber: 3, amount: 100, date: new Date(Date.now() + 86400000 * 2), status: 'PENDING' });
      return { loan, sch1, sch2, sch3 };
    };

    console.log('--- Collection Operations & Loan Updates ---');

    // 1. Exact Payment
    let setup = await createLoan();
    await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 100, paymentMode: 'CASH' }, user1);
    let updatedLoan = await Loan.findById(setup.loan._id);
    let updatedSch = await LoanSchedule.findById(setup.sch1._id);
    assert.strictEqual(updatedSch.status, 'PAID', 'Exact Payment: Schedule status should be PAID');
    assert.strictEqual(updatedLoan.paidAmount, 100, 'Exact Payment: Loan paidAmount should be 100');
    assert.strictEqual(updatedLoan.remainingAmount, 1000, 'Exact Payment: Loan remainingAmount should be 1000');
    assert.strictEqual(updatedLoan.paidDays, 1, 'Exact Payment: Loan paidDays should be 1');
    assert.strictEqual(updatedLoan.remainingDays, 10, 'Exact Payment: Loan remainingDays should be 10');
    console.log('✅ Exact Payment & Loan Update');

    // 2. Partial Payment
    setup = await createLoan();
    await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 50, paymentMode: 'CASH' }, user1);
    updatedLoan = await Loan.findById(setup.loan._id);
    updatedSch = await LoanSchedule.findById(setup.sch1._id);
    assert.strictEqual(updatedSch.status, 'PARTIAL', 'Partial Payment: Schedule status should be PARTIAL');
    assert.strictEqual(updatedSch.paidAmount, 50, 'Partial Payment: Schedule paidAmount should be 50');
    assert.strictEqual(updatedLoan.paidAmount, 50, 'Partial Payment: Loan paidAmount should be 50');
    assert.strictEqual(updatedLoan.paidDays, 0, 'Partial Payment: Loan paidDays should remain 0'); // assuming paidDays is full days? wait, our logic adds it if schedule becomes PAID. Let's see. Yes, schedule is PARTIAL, so paidDays is 0.
    console.log('✅ Partial Payment');

    // 3. Extra Payment
    setup = await createLoan();
    await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 150, paymentMode: 'CASH' }, user1);
    updatedLoan = await Loan.findById(setup.loan._id);
    updatedSch = await LoanSchedule.findById(setup.sch1._id);
    let nextSch = await LoanSchedule.findById(setup.sch2._id);
    assert.strictEqual(updatedSch.status, 'PAID', 'Extra Payment: Schedule status should be PAID');
    assert.strictEqual(nextSch.status, 'PARTIAL', 'Extra Payment: Next schedule status should be PARTIAL');
    assert.strictEqual(nextSch.paidAmount, 50, 'Extra Payment: Next schedule paidAmount should be 50');
    assert.strictEqual(updatedLoan.paidAmount, 150, 'Extra Payment: Loan paidAmount should be 150');
    console.log('✅ Extra Payment (Cascading)');

    // 4. Missed Payment & Notifications
    setup = await createLoan();
    await recordCollectionService({ loanScheduleId: setup.sch1._id, isMissed: true, remarks: 'Not home' }, user1);
    updatedSch = await LoanSchedule.findById(setup.sch1._id);
    assert.strictEqual(updatedSch.status, 'MISSED', 'Missed Payment: Schedule status should be MISSED');
    const notifs = await Notification.find({ loanScheduleId: setup.sch1._id });
    assert.strictEqual(notifs.length, 1, 'Missed Payment: Should create exactly one notification');
    console.log('✅ Missed Payment creates notification');

    // 5. Invalid LoanSchedule
    try {
      await recordCollectionService({ loanScheduleId: new mongoose.Types.ObjectId(), amountReceived: 100 }, user1);
      throw new Error('Should have thrown error for invalid schedule');
    } catch (e) {
      assert(e.message.includes('not found'), 'Should fail for invalid schedule');
      console.log('✅ Invalid LoanSchedule');
    }

    // 6. Closed Loan
    setup = await createLoan();
    await Loan.findByIdAndUpdate(setup.loan._id, { status: 'COMPLETED' });
    try {
      await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 100 }, user1);
      throw new Error('Should have thrown error for closed loan');
    } catch (e) {
      assert(e.message.includes('non-active'), 'Should fail for non-active loan');
      console.log('✅ Closed Loan');
    }

    // 7. Duplicate Collection for same schedule (if already PAID)
    setup = await createLoan();
    await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 100 }, user1);
    try {
      await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 100 }, user1);
      throw new Error('Should have thrown error for duplicate collection');
    } catch (e) {
      assert(e.message.includes('already fully paid'), 'Should fail for duplicate collection');
      console.log('✅ Duplicate Collection blocked');
    }

    // 8. Employee cannot record collection for another employee's customer
    setup = await createLoan();
    try {
      await recordCollectionService({ loanScheduleId: setup.sch1._id, amountReceived: 100 }, user2);
      throw new Error('Should have thrown error for unauthorized employee');
    } catch (e) {
      assert(e.message.includes('Unauthorized'), 'Should fail for unauthorized employee');
      console.log('✅ Security: Employee RBAC enforced');
    }

    console.log('All backend checks passed! 🚀');

  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    await Employee.deleteMany({ email: { $in: ['e1@logic.com', 'e2@logic.com'] } });
    await Customer.deleteMany({ customerCode: 'CUS_TEST1' });
    await Loan.deleteMany({ loanNumber: { $regex: '^LN_' } });
    // Note: this leaves orphaned collections, schedules, notifications. A clean db is better.
    await mongoose.disconnect();
  }
};

runTests();
