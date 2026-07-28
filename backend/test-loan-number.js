require('dotenv').config();
const mongoose = require('mongoose');
const { generateLoanNumber } = require('./src/utils/generateCode');
const Loan = require('./src/models/Loan');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create 3 dummy loans
    for (let i = 0; i < 3; i++) {
      const loanNumber = await generateLoanNumber();
      const loan = new Loan({
        loanNumber,
        customerId: new mongoose.Types.ObjectId(), // Dummy ID
        employeeId: new mongoose.Types.ObjectId(), // Dummy ID
        loanAmount: 10000,
        interestPercent: 5,
        interestAmount: 500,
        totalPayable: 10500,
        durationDays: 100,
        dailyInstallment: 105,
        maturityDate: new Date(),
        remainingAmount: 10500,
        remainingDays: 100,
        createdBy: new mongoose.Types.ObjectId() // Dummy ID
      });
      await loan.save();
      console.log(`Created Loan: ${loanNumber}`);
    }

    console.log('PASS ✅');
  } catch (error) {
    console.error('Test Failed ❌', error);
  } finally {
    await Loan.deleteMany({}); // Clean up test data
    await mongoose.disconnect();
  }
};

runTest();
