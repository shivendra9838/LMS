const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../src/config/db');

const ActivityTimeline = require('../src/models/ActivityTimeline');
const AuditLog = require('../src/models/AuditLog');
const Branch = require('../src/models/Branch');
const CashBook = require('../src/models/CashBook');
const Collection = require('../src/models/Collection');
const Customer = require('../src/models/Customer');
const CustomerTimeline = require('../src/models/CustomerTimeline');
const Employee = require('../src/models/Employee');
const Expense = require('../src/models/Expense');
const Loan = require('../src/models/Loan');
const LoanSchedule = require('../src/models/LoanSchedule');
const LoanTimeline = require('../src/models/LoanTimeline');
const Notification = require('../src/models/Notification');

const cleanup = async () => {
  await connectDB();

  const collections = [
    ['collections', Collection],
    ['loanSchedules', LoanSchedule],
    ['notifications', Notification],
    ['loanTimelines', LoanTimeline],
    ['customerTimelines', CustomerTimeline],
    ['activityTimelines', ActivityTimeline],
    ['cashBooks', CashBook],
    ['expenses', Expense],
    ['loans', Loan],
    ['customers', Customer],
    ['employees', Employee],
    ['branches', Branch],
    ['auditLogs', AuditLog]
  ];

  const results = {};

  for (const [name, model] of collections) {
    const result = await model.deleteMany({});
    results[name] = result.deletedCount;
  }

  console.log('Dummy/application data cleanup complete. Admin accounts were preserved.');
  console.table(results);

  await mongoose.connection.close();
};

cleanup().catch(async (error) => {
  console.error('Cleanup failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
