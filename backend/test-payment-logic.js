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
    const emp = await Employee.create({ employeeCode: 'EMP_LOGIC', name: 'Emp', email: 'e@logic.com', phone: '111', password: 'pwd', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId });
    const user = { id: emp._id.toString(), role: 'EMPLOYEE' };

    // --- CASE 1: EXACT PAYMENT ---
    const cus1 = await Customer.create({ customerCode: 'CUS_L1', name: 'Exact', fatherName: 'F', mobile: '999', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan1 = await Loan.create({ loanNumber: 'LN_L1', customerId: cus1._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch1 = await LoanSchedule.create({ loanId: loan1._id, dayNumber: 1, amount: 1100, date: new Date() });
    
    await recordCollectionService({ loanScheduleId: sch1._id, amountReceived: 1100, remarks: 'Exact' }, user);
    
    const updatedSch1 = await LoanSchedule.findById(sch1._id);
    const updatedLoan1 = await Loan.findById(loan1._id);
    if (updatedSch1.status !== 'PAID') throw new Error('Case 1 Failed: Schedule not PAID');
    if (updatedLoan1.paidDays !== 1 || updatedLoan1.remainingDays !== 9 || updatedLoan1.remainingAmount !== 9900) throw new Error('Case 1 Failed: Loan numbers wrong');
    console.log('Case 1: Exact Payment ✅');

    // --- CASE 2: PARTIAL PAYMENT ---
    const cus2 = await Customer.create({ customerCode: 'CUS_L2', name: 'Partial', fatherName: 'F', mobile: '998', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan2 = await Loan.create({ loanNumber: 'LN_L2', customerId: cus2._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch2 = await LoanSchedule.create({ loanId: loan2._id, dayNumber: 1, amount: 1100, date: new Date() });

    await recordCollectionService({ loanScheduleId: sch2._id, amountReceived: 500, remarks: 'Partial' }, user);
    
    const updatedSch2 = await LoanSchedule.findById(sch2._id);
    const updatedLoan2 = await Loan.findById(loan2._id);
    if (updatedSch2.status !== 'PARTIAL') throw new Error('Case 2 Failed: Schedule not PARTIAL');
    if (updatedSch2.paidAmount !== 500) throw new Error('Case 2 Failed: Schedule paidAmount wrong');
    if (updatedLoan2.paidAmount !== 500) throw new Error('Case 2 Failed: Loan paidAmount wrong');
    if (updatedLoan2.paidDays !== 0) throw new Error('Case 2 Failed: Loan paidDays wrong (should be 0 since not full installment)');
    console.log('Case 2: Partial Payment ✅');

    // --- CASE 3: EXTRA PAYMENT ---
    const cus3 = await Customer.create({ customerCode: 'CUS_L3', name: 'Extra', fatherName: 'F', mobile: '997', age: 30, gender: 'Male', occupation: 'O', address: 'A', city: 'C', area: 'A', status: 'ACTIVE', createdBy: adminId, employeeId: emp._id });
    const loan3 = await Loan.create({ loanNumber: 'LN_L3', customerId: cus3._id, employeeId: emp._id, loanAmount: 10000, interestPercent: 10, interestAmount: 1000, totalPayable: 11000, dailyInstallment: 1100, durationDays: 10, remainingAmount: 11000, remainingDays: 10, status: 'ACTIVE', loanDate: new Date(), maturityDate: new Date(), createdBy: adminId });
    const sch3_1 = await LoanSchedule.create({ loanId: loan3._id, dayNumber: 1, amount: 1100, date: new Date() });
    const sch3_2 = await LoanSchedule.create({ loanId: loan3._id, dayNumber: 2, amount: 1100, date: new Date() });

    await recordCollectionService({ loanScheduleId: sch3_1._id, amountReceived: 1500, remarks: 'Extra' }, user);
    
    const upSch3_1 = await LoanSchedule.findById(sch3_1._id);
    const upSch3_2 = await LoanSchedule.findById(sch3_2._id);
    const upLoan3 = await Loan.findById(loan3._id);
    
    if (upSch3_1.status !== 'PAID') throw new Error('Case 3 Failed: Sch 1 not PAID');
    if (upSch3_2.status !== 'PARTIAL' || upSch3_2.paidAmount !== 400) throw new Error('Case 3 Failed: Sch 2 not cascaded properly');
    if (upLoan3.paidAmount !== 1500) throw new Error('Case 3 Failed: Loan paidAmount wrong');
    
    console.log('Case 3: Extra Payment ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await LoanSchedule.deleteMany({ amount: 1100 });
    await Loan.deleteMany({ loanAmount: 10000 });
    await Customer.deleteMany({ name: { $in: ['Exact', 'Partial', 'Extra'] } });
    await Employee.deleteMany({ employeeCode: 'EMP_LOGIC' });
    await mongoose.disconnect();
  }
};

runTest();
