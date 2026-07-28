require('dotenv').config();
const mongoose = require('mongoose');
const { getTodayCollectionService } = require('./src/services/collection.service');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminId = new mongoose.Types.ObjectId();

    // 1. Create Employee Rahul
    const rahul = await Employee.create({
      employeeCode: 'EMP_RAHUL', name: 'Rahul', email: 'rahul@test.com', password: 'pwd', phone: '123', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId
    });

    // 2. Create another Employee
    const otherEmp = await Employee.create({
      employeeCode: 'EMP_OTHER', name: 'Other', email: 'other@test.com', password: 'pwd', phone: '124', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId
    });

    // 3. Create Customers for both
    const rahulCus = await Customer.create({
      customerCode: 'CUS_RAHUL1', name: 'Rahul Cus 1', fatherName: 'F', mobile: '999', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: rahul._id, employeeId: rahul._id
    });
    
    const otherCus = await Customer.create({
      customerCode: 'CUS_OTHER1', name: 'Other Cus 1', fatherName: 'F', mobile: '888', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: otherEmp._id, employeeId: otherEmp._id
    });

    // 4. Create Loans for both
    const loanR = await Loan.create({
      loanNumber: 'LN_R', customerId: rahulCus._id, employeeId: rahul._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, durationDays: 10, dailyInstallment: 1100, loanDate: new Date(), maturityDate: new Date(), remainingAmount: 11000, remainingDays: 10, createdBy: adminId
    });

    const loanO = await Loan.create({
      loanNumber: 'LN_O', customerId: otherCus._id, employeeId: otherEmp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, durationDays: 10, dailyInstallment: 1100, loanDate: new Date(), maturityDate: new Date(), remainingAmount: 11000, remainingDays: 10, createdBy: adminId
    });

    // 5. Create Schedules for TODAY
    const today = new Date();
    await LoanSchedule.create({
      loanId: loanR._id, dayNumber: 1, date: today, amount: 1100, remarks: 'TEST'
    });
    await LoanSchedule.create({
      loanId: loanO._id, dayNumber: 1, date: today, amount: 1100, remarks: 'TEST'
    });
    
    // Also create a schedule for Rahul but for TOMORROW
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await LoanSchedule.create({
      loanId: loanR._id, dayNumber: 2, date: tomorrow, amount: 1100, remarks: 'TEST'
    });

    // 6. Test the Service for Rahul
    const userRahul = { id: rahul._id.toString(), role: 'EMPLOYEE' };
    const collections = await getTodayCollectionService(userRahul);

    let passed = true;
    if (collections.length !== 1) {
      console.error(`❌ Expected exactly 1 collection for Rahul today, got ${collections.length}`);
      passed = false;
    } else {
      const col = collections[0];
      if (col.customerName !== 'Rahul Cus 1') {
        console.error('❌ Wrong customer fetched');
        passed = false;
      }
      if (col.loanNumber !== 'LN_R') {
        console.error('❌ Wrong loan fetched');
        passed = false;
      }
      if (col.todayInstallment !== 1100) {
        console.error('❌ Wrong amount');
        passed = false;
      }
    }

    if (passed) {
      console.log('Only Rahul ke customers fetched.');
      console.log('PASS ✅');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    // Cleanup
    await LoanSchedule.deleteMany({ remarks: 'TEST' });
    await Loan.deleteMany({ loanNumber: { $in: ['LN_R', 'LN_O'] } });
    await Customer.deleteMany({ customerCode: { $in: ['CUS_RAHUL1', 'CUS_OTHER1'] } });
    await Employee.deleteMany({ employeeCode: { $in: ['EMP_RAHUL', 'EMP_OTHER'] } });
    await mongoose.disconnect();
  }
};

runTest();
