require('dotenv').config();
const mongoose = require('mongoose');
const { getCollectionHistoryService, recordCollectionService } = require('./src/services/collection.service');
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
    const emp = await Employee.create({ employeeCode: 'EMP_HIST', name: 'Emp', email: 'h@logic.com', phone: '333', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const user = { id: emp._id.toString(), role: 'EMPLOYEE' };

    const cus = await Customer.create({ customerCode: 'CUS_HIST', name: 'Hist', fatherName: 'F', mobile: '777', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan = await Loan.create({ loanNumber: 'LN_HIST', customerId: cus._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch1 = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 1100, date: new Date() });
    
    await recordCollectionService({ loanScheduleId: sch1._id, amountReceived: 1100, paymentMode: 'CASH' }, user);
    
    const history = await getCollectionHistoryService(loan._id, user);
    
    if (history.length !== 1) throw new Error('History should have 1 record');
    const rec = history[0];
    if (rec.status !== 'PAID') throw new Error('Status not PAID');
    if (rec.paymentMode !== 'CASH') throw new Error('Mode not CASH');
    if (rec.amountReceived !== 1100) throw new Error('Amount not 1100');
    if (!rec.loanScheduleId || rec.loanScheduleId.dayNumber !== 1) throw new Error('Schedule population failed');
    if (!rec.collectedBy || rec.collectedBy.name !== 'Emp') throw new Error('Employee population failed');

    console.log('Collection History verified!');
    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ amount: 1100 });
    await Loan.deleteMany({ loanAmount: 10000 });
    await Customer.deleteMany({ name: 'Hist' });
    await Employee.deleteMany({ employeeCode: 'EMP_HIST' });
    await Collection.deleteMany({ amountReceived: 1100 });
    await mongoose.disconnect();
  }
};

runTest();
