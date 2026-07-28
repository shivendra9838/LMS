require('dotenv').config();
const mongoose = require('mongoose');
const { getAdminDashboardStats } = require('./src/repositories/dashboard.repository');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    console.log('Fetching Admin Dashboard Stats...');
    const start = process.hrtime();
    const stats = await getAdminDashboardStats();
    const end = process.hrtime(start);
    
    const timeInMs = (end[0] * 1000) + (end[1] / 1000000);
    console.log(`Load Time: ${timeInMs.toFixed(2)} ms`);
    
    if (timeInMs < 2000) {
      console.log('✅ PASS: Load time is under 2 seconds');
    } else {
      console.log('❌ FAIL: Load time exceeds 2 seconds');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
