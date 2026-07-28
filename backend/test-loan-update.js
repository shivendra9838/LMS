require('dotenv').config();
const mongoose = require('mongoose');
const { recordCollectionService } = require('./src/services/collection.service');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');
const LoanSchedule = require('./src/models/LoanSchedule');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminId = new mongoose.Types.ObjectId();
    const emp = await Employee.create({ employeeCode: 'EMP_UPD', name: 'Emp', email: 'u@logic.com', phone: '222', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const user = { id: emp._id.toString(), role: 'EMPLOYEE' };

    const cus = await Customer.create({ customerCode: 'CUS_UPD', name: 'Upd', fatherName: 'F', mobile: '888', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan = await Loan.create({ loanNumber: 'LN_UPD', customerId: cus._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 1100, date: new Date() });
    
    await recordCollectionService({ loanScheduleId: sch._id, amountReceived: 1100, remarks: 'Exact' }, user);
    
    const updatedLoan = await Loan.findById(loan._id);
    if (!updatedLoan.lastPaymentDate) throw new Error('lastPaymentDate not set');

    console.log('lastPaymentDate successfully recorded:', updatedLoan.lastPaymentDate);
    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ amount: 1100 });
    await Loan.deleteMany({ loanAmount: 10000 });
    await Customer.deleteMany({ name: 'Upd' });
    await Employee.deleteMany({ employeeCode: 'EMP_UPD' });
    await mongoose.disconnect();
  }
};

runTest();
