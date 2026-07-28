require('dotenv').config();
const mongoose = require('mongoose');
const Collection = require('./src/models/Collection');
const { generateCollectionNumber } = require('./src/utils/generateCode');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clean up
    await Collection.deleteMany({ remarks: 'TEST_COLLECTION_NUMBER' });

    // Dummy ObjectIds for required fields
    const dummyId = new mongoose.Types.ObjectId();

    for (let i = 0; i < 3; i++) {
      const colNum = await generateCollectionNumber();
      await Collection.create({
        collectionNumber: colNum,
        loanId: dummyId,
        loanScheduleId: dummyId,
        customerId: dummyId,
        employeeId: dummyId,
        amountReceived: 100,
        expectedAmount: 100,
        status: 'PAID',
        remarks: 'TEST_COLLECTION_NUMBER',
        collectedBy: dummyId
      });
      console.log(colNum);
    }
    
    console.log('PASS ✅');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await Collection.deleteMany({ remarks: 'TEST_COLLECTION_NUMBER' });
    await mongoose.disconnect();
  }
};

runTest();
