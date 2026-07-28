require('dotenv').config();
const mongoose = require('mongoose');
const { recordCollectionService } = require('./src/services/collection.service');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');
const Notification = require('./src/models/Notification');
const Collection = require('./src/models/Collection');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminId = new mongoose.Types.ObjectId();
    const emp = await Employee.create({ employeeCode: 'EMP_MISSED', name: 'Emp Missed', email: 'e2@logic.com', phone: '112', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const user = { id: emp._id.toString(), role: 'EMPLOYEE' };

    // --- CASE 4: MISSED PAYMENT ---
    const cus = await Customer.create({ customerCode: 'CUS_M1', name: 'Missed', fatherName: 'F', mobile: '996', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan = await Loan.create({ loanNumber: 'LN_M1', customerId: cus._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 1100, date: new Date() });
    
    await recordCollectionService({ loanScheduleId: sch._id, isMissed: true, remarks: 'Customer Not Home' }, user);
    
    const updatedSch = await LoanSchedule.findById(sch._id);
    const updatedLoan = await Loan.findById(loan._id);
    const notification = await Notification.findOne({ loanScheduleId: sch._id });
    const collection = await Collection.findOne({ loanScheduleId: sch._id });

    if (updatedSch.status !== 'MISSED') throw new Error('Case 4 Failed: Schedule not MISSED');
    if (updatedLoan.remainingAmount !== 11000) throw new Error('Case 4 Failed: Loan amount changed');
    if (collection.status !== 'MISSED') throw new Error('Case 4 Failed: Collection not MISSED');
    if (!notification) throw new Error('Case 4 Failed: Notification not created');
    if (notification.type !== 'MISSED_PAYMENT') throw new Error('Case 4 Failed: Incorrect notification type');

    console.log('Case 4: Missed Payment ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ amount: 1100 });
    await Loan.deleteMany({ loanAmount: 10000 });
    await Customer.deleteMany({ name: 'Missed' });
    await Employee.deleteMany({ employeeCode: 'EMP_MISSED' });
    await Notification.deleteMany({ type: 'MISSED_PAYMENT' });
    await mongoose.disconnect();
  }
};

runTest();
