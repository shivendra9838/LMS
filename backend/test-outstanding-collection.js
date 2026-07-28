require('dotenv').config();
const mongoose = require('mongoose');
const { getOutstandingReports, getCollectionReports } = require('./src/repositories/report.repository');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const Collection = require('./src/models/Collection');
const LoanSchedule = require('./src/models/LoanSchedule');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const mockId = new mongoose.Types.ObjectId();
    const tag = `OS_COL_${Date.now()}`;
    
    // Setup Outstanding Report Test Data
    const emp = await Employee.create({
      _id: mockId, employeeCode: tag, name: 'E1', email: `${tag}@test.com`,
      phone: '123', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', role: 'EMPLOYEE', createdBy: mockId
    });

    const cust = await Customer.create({
      customerCode: tag, name: 'C1', fatherName: 'F1', age: 30, occupation: 'Job',
      address: 'Add', city: 'C', area: 'A', mobile: '123', status: 'ACTIVE', employeeId: emp._id, createdBy: emp._id
    });

    const loan = await Loan.create({
      loanNumber: tag, customerId: cust._id, employeeId: emp._id,
      loanAmount: 1000, interestPercent: 10, interestAmount: 100, totalPayable: 1100, dailyInstallment: 110, durationDays: 10,
      remainingAmount: 900, remainingDays: 9, paidAmount: 200, paidDays: 1, status: 'ACTIVE',
      loanDate: new Date(), maturityDate: new Date(), createdBy: emp._id
    });

    // Test Outstanding Report
    const osReports = await getOutstandingReports({ employeeId: emp._id.toString() });
    console.log(`\n--- Verification for Outstanding Report ---`);
    if (osReports.length === 1 && osReports[0].outstandingAmount === 900) {
      console.log('✅ PASS: Outstanding = Loan Remaining Amount.');
    } else {
      console.log('❌ FAIL: Outstanding mismatch.');
    }

    // Setup Collection Report Test Data
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 110, date: new Date(), status: 'PAID', paidAmount: 110 });
    
    await Collection.create({
      collectionNumber: `${tag}_1`, loanId: loan._id, loanScheduleId: sch._id, customerId: cust._id, employeeId: emp._id,
      amountReceived: 50, expectedAmount: 50, paymentMode: 'CASH', paymentDate: new Date(), collectedBy: emp._id, status: 'PAID'
    });
    
    await Collection.create({
      collectionNumber: `${tag}_2`, loanId: loan._id, loanScheduleId: sch._id, customerId: cust._id, employeeId: emp._id,
      amountReceived: 150, expectedAmount: 150, paymentMode: 'UPI', paymentDate: new Date(), collectedBy: emp._id, status: 'PAID'
    });

    // Test Collection Report
    const colReport = await getCollectionReports({ period: 'today' });
    console.log(`\n--- Verification for Collection Report ---`);
    if (
      colReport.breakdown.cash.amount >= 50 &&
      colReport.breakdown.upi.amount >= 150 &&
      colReport.totalAmount >= 200
    ) {
       console.log('✅ PASS: Payment mode totals match Collection table.');
    } else {
       console.log('❌ FAIL: Collection totals mismatch.');
    }
    
    // Cleanup
    await Employee.deleteOne({ _id: emp._id });
    await Customer.deleteOne({ _id: cust._id });
    await Loan.deleteOne({ _id: loan._id });
    await LoanSchedule.deleteMany({ loanId: loan._id });
    await Collection.deleteMany({ loanId: loan._id });
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
