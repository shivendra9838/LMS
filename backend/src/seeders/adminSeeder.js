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
    
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '');

    if (!adminEmail || !adminPassword) {
      console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be configured in .env');
      process.exit(1);
    }

    // Check if admin already exists
    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      admin = await Admin.findOne({ role: 'ADMIN' });
    }

    if (admin) {
      admin.name = process.env.ADMIN_NAME || admin.name || 'Kamlakant Tiwari';
      admin.email = adminEmail;
      admin.password = adminPassword; // Will be hashed automatically by pre-save hook
      admin.isActive = true;
      await admin.save();
      console.log(`Admin credentials updated successfully for ${adminEmail}!`);
      console.log('PASS ✅');
      process.exit(0);
    }

    admin = new Admin({
      name: process.env.ADMIN_NAME || 'Kamlakant Tiwari',
      email: adminEmail,
      password: adminPassword, // Will be hashed automatically by pre-save hook
      phone: process.env.ADMIN_PHONE || '9569574750',
      role: 'ADMIN',
      isActive: true
    });

    await admin.save();
    console.log(`Admin ${adminEmail} seeded successfully!`);
    console.log('PASS ✅');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
