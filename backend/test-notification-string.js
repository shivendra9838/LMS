require('dotenv').config();
const mongoose = require('mongoose');
const { recordCollectionService } = require('./src/services/collection.service');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');
const Notification = require('./src/models/Notification');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminId = new mongoose.Types.ObjectId();
    const emp = await Employee.create({ employeeCode: 'EMP_N', name: 'Rahul', email: 'r@logic.com', phone: '1', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const user = { id: emp._id.toString(), role: 'EMPLOYEE' };

    const cus = await Customer.create({ customerCode: 'CUS_N', name: 'Ramesh Kumar', fatherName: 'F', mobile: '9', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'Mumbai', area: 'Vashi', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan = await Loan.create({ loanNumber: 'LN_N', customerId: cus._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 1100, date: new Date() });
    
    await recordCollectionService({ loanScheduleId: sch._id, isMissed: true, remarks: 'Not Home' }, user);
    
    const notification = await Notification.findOne({ loanScheduleId: sch._id });
    console.log('Notification Message Generated:', notification.message);

    if (notification.message !== `Customer Ramesh Kumar, Employee Rahul, Area Mumbai - Vashi, Today's installment missed.`) {
      throw new Error('Message format mismatch');
    }

    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ amount: 1100 });
    await Loan.deleteMany({ loanNumber: 'LN_N' });
    await Customer.deleteMany({ customerCode: 'CUS_N' });
    await Employee.deleteMany({ employeeCode: 'EMP_N' });
    await Notification.deleteMany({ type: 'MISSED_PAYMENT' });
    await mongoose.disconnect();
  }
};

runTest();
