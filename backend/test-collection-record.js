require('dotenv').config();
const mongoose = require('mongoose');
const { recordCollectionService } = require('./src/services/collection.service');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');
const Collection = require('./src/models/Collection');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminId = new mongoose.Types.ObjectId();

    // 1. Create Employee
    const rahul = await Employee.create({
      employeeCode: 'EMP_RAHUL2', name: 'Rahul', email: 'rahul2@test.com', password: 'pwd', phone: '123', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId
    });

    // 2. Create Customer
    const rahulCus = await Customer.create({
      customerCode: 'CUS_RAHUL2', name: 'Rahul Cus 2', fatherName: 'F', mobile: '999', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: rahul._id, employeeId: rahul._id
    });
    
    // 3. Create Loan
    const loan = await Loan.create({
      loanNumber: 'LN_TEST', customerId: rahulCus._id, employeeId: rahul._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, durationDays: 10, dailyInstallment: 1100, loanDate: new Date(), maturityDate: new Date(), remainingAmount: 11000, remainingDays: 10, createdBy: adminId, status: 'ACTIVE'
    });

    // 4. Create Schedule
    const schedule = await LoanSchedule.create({
      loanId: loan._id, dayNumber: 1, date: new Date(), amount: 1100, remarks: 'TEST'
    });
    
    // 5. Test Collection Record
    const userRahul = { id: rahul._id.toString(), role: 'EMPLOYEE' };
    const reqBody = {
      loanScheduleId: schedule._id.toString(),
      amountReceived: 1100,
      paymentMode: 'CASH',
      remarks: 'Paid on time'
    };

    const collection = await recordCollectionService(reqBody, userRahul);
    
    console.log('Collection created:', collection.collectionNumber);

    // Verify Schedule
    const updatedSchedule = await LoanSchedule.findById(schedule._id);
    if (updatedSchedule.status !== 'PAID') throw new Error('Schedule status not PAID');
    if (updatedSchedule.paidAmount !== 1100) throw new Error('Schedule paidAmount incorrect');

    // Verify Loan
    const updatedLoan = await Loan.findById(loan._id);
    if (updatedLoan.paidAmount !== 1100) throw new Error('Loan paidAmount incorrect');
    if (updatedLoan.remainingAmount !== 9900) throw new Error('Loan remainingAmount incorrect');
    if (updatedLoan.paidDays !== 1) throw new Error('Loan paidDays incorrect');
    if (updatedLoan.remainingDays !== 9) throw new Error('Loan remainingDays incorrect');

    console.log('Transaction Flow fully verified!');
    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    // Cleanup
    await LoanSchedule.deleteMany({ remarks: 'TEST' });
    await Loan.deleteMany({ loanNumber: 'LN_TEST' });
    await Customer.deleteMany({ customerCode: 'CUS_RAHUL2' });
    await Employee.deleteMany({ employeeCode: 'EMP_RAHUL2' });
    await Collection.deleteMany({ remarks: 'Paid on time' });
    await mongoose.disconnect();
  }
};

runTest();
