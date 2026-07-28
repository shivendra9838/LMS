require('dotenv').config();
const mongoose = require('mongoose');
const { processMissedPayments } = require('./src/jobs/endOfDayCron');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');
const Notification = require('./src/models/Notification');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // We don't need a dummy admin anymore since we use SYSTEM internally
    const adminId = new mongoose.Types.ObjectId();

    const emp = await Employee.create({ employeeCode: 'EMP_CRON', name: 'Rahul Cron', email: 'rc@logic.com', phone: '555', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });

    const cus = await Customer.create({ customerCode: 'CUS_CRON', name: 'Ramesh Cron', fatherName: 'F', mobile: '666', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'Mumbai', area: 'Vashi', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan = await Loan.create({ loanNumber: 'LN_CRON', customerId: cus._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    
    // Create a PENDING schedule for TODAY
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 1100, date: new Date(), status: 'PENDING' });
    
    // Run the Cron job manually
    await processMissedPayments();
    
    const updatedSch = await LoanSchedule.findById(sch._id);
    if (updatedSch.status !== 'MISSED') throw new Error('Schedule not updated to MISSED');

    const notification = await Notification.findOne({ loanScheduleId: sch._id });
    if (!notification) throw new Error('Notification not created');

    console.log('Cron Job Test Verified!');
    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ status: 'MISSED' });
    await Loan.deleteMany({ loanNumber: 'LN_CRON' });
    await Customer.deleteMany({ customerCode: 'CUS_CRON' });
    await Employee.deleteMany({ email: { $in: ['ac@logic.com', 'rc@logic.com'] } });
    await Notification.deleteMany({ type: 'MISSED_PAYMENT' });
    await mongoose.disconnect();
  }
};

runTest();
