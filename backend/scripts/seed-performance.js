require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Employee = require('../src/models/Employee');
const Customer = require('../src/models/Customer');
const Loan = require('../src/models/Loan');
const Collection = require('../src/models/Collection');
const LoanSchedule = require('../src/models/LoanSchedule');
const { hashPassword } = require('../src/utils/password');

async function seedPerformanceData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Get Admin
    const admin = await Admin.findOne();
    if (!admin) throw new Error('Admin not found. Run base seed first.');
    const adminId = admin._id;

    // 1. Employees (100)
    console.log('Seeding 100 Employees...');
    const employees = [];
    const password = await hashPassword('password123');
    for (let i = 1; i <= 100; i++) {
      employees.push({
        name: `Perf Employee ${i}`,
        email: `employee${i}@perf.com`,
        password,
        phone: `900000${i.toString().padStart(4, '0')}`,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        employeeCode: `EMP-P-${i}`,
        area: i % 2 === 0 ? 'Vashi' : 'Andheri',
        city: 'Mumbai',
        createdBy: adminId
      });
    }
    await Employee.deleteMany({ employeeCode: { $regex: /^EMP-P/ } });
    const insertedEmployees = await Employee.insertMany(employees);
    console.log(`Inserted ${insertedEmployees.length} employees`);

    // 2. Customers (10,000)
    console.log('Seeding 10,000 Customers...');
    await Customer.deleteMany({ customerCode: { $regex: /^CUST-P/ } });
    const customers = [];
    for (let i = 1; i <= 10000; i++) {
      // distribute customers evenly among employees
      const emp = insertedEmployees[i % insertedEmployees.length];
      customers.push({
        customerCode: `CUST-P-${i}`,
        employeeId: emp._id,
        name: `Perf Customer ${i}`,
        fatherName: 'Father',
        mobile: `80000${i.toString().padStart(5, '0')}`,
        age: 30,
        gender: 'Male',
        occupation: 'Business',
        address: 'Perf Address',
        city: emp.city,
        area: emp.area,
        status: 'ACTIVE',
        createdBy: adminId
      });
    }
    // Insert in batches of 2000
    let insertedCustomers = [];
    for (let i = 0; i < customers.length; i += 2000) {
      const batch = customers.slice(i, i + 2000);
      const res = await Customer.insertMany(batch);
      insertedCustomers.push(...res);
      console.log(`Inserted customers batch ${i} to ${i + 2000}`);
    }

    // 3. Loans (10,000)
    console.log('Seeding 10,000 Loans...');
    await Loan.deleteMany({ loanNumber: { $regex: /^LN-P/ } });
    const loans = [];
    for (let i = 0; i < 10000; i++) {
      const cust = insertedCustomers[i];
      loans.push({
        loanNumber: `LN-P-${i + 1}`,
        customerId: cust._id,
        employeeId: cust.employeeId,
        loanAmount: 10000,
        interestPercent: 10,
        interestAmount: 1000,
        totalPayable: 11000,
        durationDays: 100,
        dailyInstallment: 110,
        loanDate: new Date('2026-05-01'),
        maturityDate: new Date('2026-08-08'),
        paidAmount: 5500,
        remainingAmount: 5500,
        paidDays: 50,
        remainingDays: 50,
        lastPaymentDate: new Date('2026-06-19'),
        status: 'ACTIVE',
        createdBy: adminId
      });
    }
    let insertedLoans = [];
    for (let i = 0; i < loans.length; i += 2000) {
      const batch = loans.slice(i, i + 2000);
      const res = await Loan.insertMany(batch);
      insertedLoans.push(...res);
      console.log(`Inserted loans batch ${i} to ${i + 2000}`);
    }

    // 4. Collections (500,000) and Schedules
    // For 10,000 loans, let's say each loan has 50 payments -> 500,000 collections total.
    console.log('Seeding 500,000 Collections & Schedules...');
    await Collection.deleteMany({ collectionNumber: { $regex: /^COL-P/ } });
    await LoanSchedule.deleteMany({ loanId: { $in: insertedLoans.map(l => l._id) } });

    // Generate in batches
    let collectionCounter = 1;
    for (let i = 0; i < insertedLoans.length; i += 500) {
      const loanBatch = insertedLoans.slice(i, i + 500);
      const scheduleDocs = [];
      const collectionDocs = [];

      for (const loan of loanBatch) {
        // Generate 100 schedules for each loan, mark first 50 as PAID
        let currentDate = new Date(loan.loanDate);
        for (let day = 1; day <= 100; day++) {
          const isPaid = day <= 50;
          
          const schedId = new mongoose.Types.ObjectId();
          scheduleDocs.push({
            _id: schedId,
            loanId: loan._id,
            dayNumber: day,
            date: new Date(currentDate),
            amount: 110,
            status: isPaid ? 'PAID' : 'PENDING',
            paidAmount: isPaid ? 110 : 0,
            paidDate: isPaid ? new Date(currentDate) : null
          });

          if (isPaid) {
            collectionDocs.push({
              collectionNumber: `COL-P-${collectionCounter++}`,
              loanId: loan._id,
              customerId: loan.customerId,
              employeeId: loan.employeeId,
              loanScheduleId: schedId,
              expectedAmount: 110,
              amountReceived: 110,
              paymentMode: 'CASH',
              collectionDate: new Date(currentDate),
              status: 'PAID',
              collectedBy: loan.employeeId
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      await LoanSchedule.insertMany(scheduleDocs);
      await Collection.insertMany(collectionDocs);
      console.log(`Processed loans ${i} to ${i + 500} (Created ${collectionDocs.length} collections)`);
    }

    console.log('Seeding complete!');
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedPerformanceData();
