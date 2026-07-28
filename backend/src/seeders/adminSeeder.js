const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = require('../config/db');
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    await connectDB();
    
    // Clear existing admins (optional, but ensures clean state for test)
    // await Admin.deleteMany({});
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@loan.com' });
    if (existingAdmin) {
      console.log('Admin already exists!');
      process.exit(0);
    }

    const admin = new Admin({
      name: 'Super Admin',
      email: 'admin@loan.com',
      password: 'Admin@123', // Will be hashed automatically by pre-save hook
      phone: '9999999999',
      role: 'ADMIN',
      isActive: true
    });

    await admin.save();
    console.log('Admin seeded successfully!');
    console.log('PASS ✅');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
