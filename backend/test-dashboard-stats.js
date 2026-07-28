require('dotenv').config();
const mongoose = require('mongoose');
const { getAdminDashboardStats, getEmployeeDashboardStats } = require('./src/repositories/dashboard.repository');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // We can assume there are some loans, schedules, and collections from the previous tests if they weren't fully cleaned up, or we can just fetch and print them to ensure the aggregations don't crash.
    const adminStats = await getAdminDashboardStats();
    console.log('Admin Dashboard Stats:', adminStats);
    
    // Pick an employee
    const Employee = require('./src/models/Employee');
    const emp = await Employee.findOne();
    if (emp) {
      const empStats = await getEmployeeDashboardStats(emp._id);
      console.log('Employee Dashboard Stats:', empStats);
    } else {
      console.log('No employees found, skipping employee stats check.');
    }

    console.log('PASS ✅');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
