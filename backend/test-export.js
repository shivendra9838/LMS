require('dotenv').config();
const mongoose = require('mongoose');
const { getExportData } = require('./src/repositories/report.repository');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Fetch data for collections export
    const data = await getExportData('collections', {});
    
    console.log(`\n--- Verification for Export Data ---`);
    if (data && Array.isArray(data)) {
       console.log(`✅ PASS: Successfully retrieved export data. Count: ${data.length}`);
       if (data.length > 0) {
         const firstRow = data[0];
         if ('loanNumber' in firstRow && 'customer' in firstRow && 'expectedAmount' in firstRow) {
           console.log(`✅ PASS: Columns mapped correctly.`);
         } else {
           console.log(`❌ FAIL: Columns mapping incorrect.`);
           console.log(firstRow);
         }
       }
    } else {
       console.log('❌ FAIL: Data mismatch.');
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
