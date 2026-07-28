require('dotenv').config();
const mongoose = require('mongoose');
const { getDailyReports } = require('./src/repositories/report.repository');
const Collection = require('./src/models/Collection');
const LoanSchedule = require('./src/models/LoanSchedule');
const Loan = require('./src/models/Loan');
const Customer = require('./src/models/Customer');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Mock Data
    const mockId = new mongoose.Types.ObjectId();
    const loanNum = `REP_TEST_${Date.now()}`;
    const customer = await mongoose.model('Customer').create({
      _id: mockId,
      customerCode: loanNum,
      name: 'Test Customer',
      fatherName: 'Test Father',
      age: 30,
      occupation: 'Job',
      address: 'Test Address',
      city: 'Test City',
      area: 'Test Area',
      mobile: '1234567890',
      status: 'ACTIVE',
      employeeId: mockId,
      createdBy: new mongoose.Types.ObjectId()
    });
    const loan = await mongoose.model('Loan').create({
      loanNumber: loanNum,
      customerId: mockId, employeeId: mockId,
      loanAmount: 1000, interestPercent: 10, interestAmount: 100, totalPayable: 1100,
      dailyInstallment: 10, durationDays: 110, remainingAmount: 1100,
      remainingDays: 110, paidAmount: 0, paidDays: 0, status: 'ACTIVE',
      loanDate: new Date(), maturityDate: new Date(), createdBy: mockId
    });
    const sch = await LoanSchedule.create({ loanId: loan._id, dayNumber: 1, amount: 10, date: new Date(), status: 'PAID', paidAmount: 10 });
    const colNum = `C1_${Date.now()}`;
    await Collection.create({ 
      collectionNumber: colNum, 
      loanId: loan._id, 
      loanScheduleId: sch._id, 
      customerId: mockId, 
      employeeId: mockId, 
      amountReceived: 10, 
      expectedAmount: 10,
      paymentMode: 'CASH', 
      paymentDate: new Date(),
      collectedBy: mockId,
      status: 'PAID'
    });

    // Test the new Daily Report function
    const reports = await getDailyReports({});
    
    // Pick the most recent date reported (e.g. today's date string)
    if (reports.length === 0) {
      console.log('No reports generated. Try creating some collections first.');
      return;
    }

    const testDate = reports[0].date;
    const reportData = reports[0];
    
    // Verify against raw Collection records
    // Sum of amountReceived where paymentDate is on testDate
    const d = new Date(testDate);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    const collections = await Collection.aggregate([
      { $match: { paymentDate: { $gte: d, $lte: end } } },
      { $lookup: { from: 'loans', localField: 'loanId', foreignField: '_id', as: 'loan' } },
      { $unwind: '$loan' },
      { $group: { _id: null, totalCollectionAmount: { $sum: '$amountReceived' } } }
    ]);
    
    const rawCollectionAmount = collections.length > 0 ? collections[0].totalCollectionAmount : 0;
    
    console.log(`\n--- Verification for ${testDate} ---`);
    console.log(`Report collectionAmount: ${reportData.collectionAmount}`);
    console.log(`Raw Collection amountReceived: ${rawCollectionAmount}`);
    
    if (reportData.collectionAmount === rawCollectionAmount) {
      console.log('✅ PASS: Daily report collection amount matches raw Collection records.');
    } else {
      console.log('❌ FAIL: Mismatch between report and raw records.');
    }
    
    // Cleanup
    await mongoose.model('Customer').deleteMany({ _id: mockId });
    await mongoose.model('Loan').deleteMany({ loanNumber: loanNum });
    await LoanSchedule.deleteMany({ loanId: loan._id });
    await Collection.deleteMany({ collectionNumber: colNum });
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
