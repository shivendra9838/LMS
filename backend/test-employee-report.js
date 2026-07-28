require('dotenv').config();
const mongoose = require('mongoose');
const { getEmployeeReports } = require('./src/repositories/report.repository');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Create Mock Data
    const mockId = new mongoose.Types.ObjectId();
    const mockCode = `EMP_REP_${Date.now()}`;
    
    const emp = await Employee.create({
      _id: mockId,
      employeeCode: mockCode,
      name: 'Test Employee',
      email: `${mockCode}@test.com`,
      phone: '9998887776',
      password: 'pwd',
      city: 'Test City',
      area: 'Test Area',
      status: 'ACTIVE',
      role: 'EMPLOYEE',
      createdBy: mockId
    });

    const custId = new mongoose.Types.ObjectId();
    await Customer.create({
      _id: custId,
      customerCode: mockCode,
      name: 'Test Customer',
      fatherName: 'Father',
      age: 30,
      occupation: 'Job',
      address: 'Add',
      city: 'Test City',
      area: 'Test Area',
      mobile: '9998887775',
      status: 'ACTIVE',
      employeeId: emp._id,
      createdBy: emp._id
    });

    const loan = await Loan.create({
      loanNumber: mockCode,
      customerId: custId,
      employeeId: emp._id,
      loanAmount: 100, interestPercent: 10, interestAmount: 10, totalPayable: 110,
      dailyInstallment: 10, durationDays: 11, remainingAmount: 110,
      remainingDays: 11, paidAmount: 0, paidDays: 0, status: 'ACTIVE',
      loanDate: new Date(), maturityDate: new Date(), createdBy: emp._id
    });

    // Todays Schedule
    await LoanSchedule.create({
      loanId: loan._id,
      dayNumber: 1,
      amount: 10,
      date: new Date(),
      status: 'PAID',
      paidAmount: 9 // Partial / slightly less paid
    });
    
    // Another Schedule for same day missed
    await LoanSchedule.create({
      loanId: loan._id,
      dayNumber: 2,
      amount: 10,
      date: new Date(),
      status: 'MISSED',
      paidAmount: 0
    });

    // Test Employee Report
    const reports = await getEmployeeReports({});
    
    const myEmp = reports.find(r => r.employeeCode === mockCode);
    
    if (!myEmp) {
      console.log('❌ FAIL: Employee not found in report');
      return;
    }

    console.log(`\n--- Verification for ${myEmp.name} ---`);
    console.log(`Customers: ${myEmp.customers} (Expected: 1)`);
    console.log(`Loans: ${myEmp.loans} (Expected: 1)`);
    console.log(`Today's Collection: ${myEmp.todaysCollection} (Expected: 9)`);
    console.log(`Pending: ${myEmp.pending} (Expected: 0)`);
    console.log(`Missed: ${myEmp.missed} (Expected: 1)`);
    console.log(`Outstanding: ${myEmp.outstanding} (Expected: 110)`);
    console.log(`Efficiency: ${myEmp.collectionEfficiency}% (Expected: 45)`); // 9 / (10 + 10) * 100
    
    if (
      myEmp.customers === 1 &&
      myEmp.loans === 1 &&
      myEmp.todaysCollection === 9 &&
      myEmp.missed === 1 &&
      myEmp.outstanding === 110 &&
      myEmp.collectionEfficiency === 45
    ) {
      console.log('✅ PASS: Employee statistics match database.');
    } else {
      console.log('❌ FAIL: Statistics mismatch.');
    }
    
    // Cleanup
    await Employee.deleteOne({ _id: emp._id });
    await Customer.deleteOne({ _id: custId });
    await Loan.deleteOne({ _id: loan._id });
    await LoanSchedule.deleteMany({ loanId: loan._id });
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
