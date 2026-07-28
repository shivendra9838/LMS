require('dotenv').config();
const mongoose = require('mongoose');
const { getCollectionReceiptService, recordCollectionService } = require('./src/services/collection.service');
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
    const emp = await Employee.create({ employeeCode: 'EMP_R', name: 'Emp R', email: 'er@logic.com', phone: '777', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const user = { id: emp._id.toString(), role: 'EMPLOYEE' };

    const cus = await Customer.create({ customerCode: 'CUS_R', name: 'Cus R', fatherName: 'F', mobile: '888', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'Mumbai', area: 'Vashi', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan = await Loan.create({ loanNumber: 'LN_R', customerId: cus._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 1100, date: new Date() });
    
    const collection = await recordCollectionService({ loanScheduleId: sch._id, amountReceived: 1100, paymentMode: 'CASH' }, user);
    
    const receipt = await getCollectionReceiptService(collection._id, user);
    
    console.log('Receipt Generated:', receipt);

    if (receipt.customerName !== 'Cus R') throw new Error('Customer Name mismatch');
    if (receipt.amount !== 1100) throw new Error('Amount mismatch');
    if (receipt.mode !== 'CASH') throw new Error('Mode mismatch');

    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ amount: 1100 });
    await Loan.deleteMany({ loanNumber: 'LN_R' });
    await Customer.deleteMany({ customerCode: 'CUS_R' });
    await Employee.deleteMany({ employeeCode: 'EMP_R' });
    await Collection.deleteMany({ amountReceived: 1100 });
    await mongoose.disconnect();
  }
};

runTest();
