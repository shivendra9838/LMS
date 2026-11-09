// Isolated browser QA server. Never connects to MONGODB_URI or an existing database.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const crypto = require('crypto');
process.env.KYC_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
const app = require('../src/app');
const Admin = require('../src/models/Admin');
const Employee = require('../src/models/Employee');

(async () => {
  const memory = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(memory.getUri(), { dbName: 'lms_isolated_browser_qa' });
  const admin = await Admin.create({ name: 'QA Admin', email: 'admin@kyc.test', password: 'PreviewOnly123!', phone: '9876543200' });
  await Employee.create({ name: 'QA Employee', employeeCode: 'EMP0001', email: 'employee@kyc.test', password: 'PreviewOnly123!', phone: '9876543201', city: 'Mumbai', area: 'Central', createdBy: admin._id });
  const server = app.listen(5101, '127.0.0.1', () => console.log('Isolated KYC QA API ready on http://127.0.0.1:5101'));
  const stop = async () => { server.close(); await mongoose.disconnect(); await memory.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch(err => { console.error(err.message); process.exit(1); });
