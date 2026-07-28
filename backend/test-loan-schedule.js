require('dotenv').config();
const mongoose = require('mongoose');
const { createLoanService } = require('./src/services/loan.service');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');
const Customer = require('./src/models/Customer');
const Employee = require('./src/models/Employee');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Setup dummy admin
    const adminId = new mongoose.Types.ObjectId();

    // Setup dummy employee and customer
    const employee = await Employee.create({
      employeeCode: 'EMP9999',
      name: 'Test Emp',
      email: 'testemp@lms.com',
      password: 'hash',
      phone: '9999999999',
      city: 'Mumbai',
      area: 'Vashi',
      status: 'ACTIVE',
      createdBy: adminId
    });

    const customer = await Customer.create({
      customerCode: 'CUS999999',
      name: 'Test Customer',
      fatherName: 'Father',
      mobile: '8888888888',
      age: 30,
      gender: 'Male',
      occupation: 'Test',
      address: 'Test',
      city: 'Mumbai',
      area: 'Vashi',
      status: 'ACTIVE',
      createdBy: employee._id,
      employeeId: employee._id
    });

    console.log('Dummy Data Created');

    // Create Loan for 120 days
    const loanData = {
      customerId: customer._id,
      loanAmount: 100000,
      interestPercent: 7,
      durationDays: 120,
      loanDate: new Date().toISOString()
    };

    const user = { id: employee._id.toString(), role: 'EMPLOYEE' };

    const newLoan = await createLoanService(loanData, user);
    console.log(`Loan Created: ${newLoan.loanNumber}`);

    // Verify Schedules
    const count = await LoanSchedule.countDocuments({ loanId: newLoan._id });
    console.log(`Generated Schedules: ${count}`);

    if (count === 120) {
      console.log('PASS ✅');
    } else {
      console.log('FAIL ❌');
    }

    // Check first day
    const day1 = await LoanSchedule.findOne({ loanId: newLoan._id, dayNumber: 1 });
    console.log(`Day 1 Amount: ${day1.amount} Status: ${day1.status}`);

  } catch (error) {
    console.error('Test Failed ❌', error);
  } finally {
    // Cleanup
    await LoanSchedule.deleteMany({});
    await Loan.deleteMany({});
    await Customer.deleteMany({ mobile: '8888888888' });
    await Employee.deleteMany({ email: 'testemp@lms.com' });
    await mongoose.disconnect();
  }
};

runTest();
