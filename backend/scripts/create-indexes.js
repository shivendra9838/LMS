require('dotenv').config();
const mongoose = require('mongoose');

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const db = mongoose.connection.db;

    console.log('Creating Collection indexes...');
    await db.collection('collections').createIndex({ loanId: 1 });
    await db.collection('collections').createIndex({ employeeId: 1 });
    await db.collection('collections').createIndex({ paymentDate: -1 });
    await db.collection('collections').createIndex({ status: 1 });
    await db.collection('collections').createIndex({ employeeId: 1, paymentDate: -1 });

    console.log('Creating Loan indexes...');
    try { await db.collection('loans').createIndex({ customerId: 1 }); } catch (e) {}
    try { await db.collection('loans').createIndex({ employeeId: 1 }); } catch (e) {}
    try { await db.collection('loans').createIndex({ status: 1 }); } catch (e) {}
    try { await db.collection('loans').createIndex({ loanNumber: 1 }, { unique: true }); } catch (e) {}
    try { await db.collection('loans').createIndex({ remainingAmount: -1 }); } catch (e) {}
    try { await db.collection('loans').createIndex({ employeeId: 1, status: 1 }); } catch (e) {}

    console.log('Creating Customer indexes...');
    try { await db.collection('customers').createIndex({ employeeId: 1 }); } catch (e) {}
    try { await db.collection('customers').createIndex({ city: 1 }); } catch (e) {}
    try { await db.collection('customers').createIndex({ area: 1 }); } catch (e) {}
    try { await db.collection('customers').createIndex({ status: 1 }); } catch (e) {}
    try { await db.collection('customers').createIndex({ city: 1, area: 1 }); } catch (e) {}
    try { await db.collection('customers').createIndex({ employeeId: 1, status: 1 }); } catch (e) {}

    console.log('Creating LoanSchedule indexes...');
    try { await db.collection('loanschedules').createIndex({ date: 1 }); } catch (e) {}
    try { await db.collection('loanschedules').createIndex({ status: 1, date: 1 }); } catch (e) {}

    console.log('All requested indexes created successfully!');
  } catch (err) {
    console.error('Error creating indexes:', err);
  } finally {
    await mongoose.disconnect();
  }
}

createIndexes();
