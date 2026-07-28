require('dotenv').config();
const mongoose = require('mongoose');
const { getAreaReports, getEmployeeReports } = require('./src/repositories/report.repository');
const Employee = require('./src/models/Employee');
const Customer = require('./src/models/Customer');
const Loan = require('./src/models/Loan');

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Create Mock Data for a specific Area
    const mockId1 = new mongoose.Types.ObjectId();
    const mockId2 = new mongoose.Types.ObjectId();
    const city = 'Mumbai';
    const area = `Vashi_${Date.now()}`; // Unique area to test isolation

    // Employee 1
    const emp1 = await Employee.create({
      _id: mockId1, employeeCode: `E1_${Date.now()}`, name: 'E1', email: `e1_${Date.now()}@test.com`,
      phone: '111', password: 'pwd', city, area, status: 'ACTIVE', role: 'EMPLOYEE', createdBy: mockId1
    });

    // Employee 2
    const emp2 = await Employee.create({
      _id: mockId2, employeeCode: `E2_${Date.now()}`, name: 'E2', email: `e2_${Date.now()}@test.com`,
      phone: '222', password: 'pwd', city, area, status: 'ACTIVE', role: 'EMPLOYEE', createdBy: mockId2
    });

    // Customer for Emp1
    const cust1 = await Customer.create({
      customerCode: `C1_${Date.now()}`, name: 'C1', fatherName: 'F1', age: 30, occupation: 'Job',
      address: 'Add', city, area, mobile: '111', status: 'ACTIVE', employeeId: emp1._id, createdBy: emp1._id
    });

    // Customer for Emp2
    const cust2 = await Customer.create({
      customerCode: `C2_${Date.now()}`, name: 'C2', fatherName: 'F2', age: 30, occupation: 'Job',
      address: 'Add', city, area, mobile: '222', status: 'ACTIVE', employeeId: emp2._id, createdBy: emp2._id
    });

    // Loans for C1 and C2
    const loan1 = await Loan.create({
      loanNumber: `L1_${Date.now()}`, customerId: cust1._id, employeeId: emp1._id,
      loanAmount: 100, interestPercent: 10, interestAmount: 10, totalPayable: 110, dailyInstallment: 10, durationDays: 11,
      remainingAmount: 110, remainingDays: 11, paidAmount: 0, paidDays: 0, status: 'ACTIVE',
      loanDate: new Date(), maturityDate: new Date(), createdBy: emp1._id
    });

    const loan2 = await Loan.create({
      loanNumber: `L2_${Date.now()}`, customerId: cust2._id, employeeId: emp2._id,
      loanAmount: 200, interestPercent: 10, interestAmount: 20, totalPayable: 220, dailyInstallment: 20, durationDays: 11,
      remainingAmount: 220, remainingDays: 11, paidAmount: 0, paidDays: 0, status: 'ACTIVE',
      loanDate: new Date(), maturityDate: new Date(), createdBy: emp2._id
    });

    // Test Area Reports
    const areaReports = await getAreaReports({});
    const myArea = areaReports.find(r => r.area === area);

    if (!myArea) {
      console.log('❌ FAIL: Area not found in report');
      return;
    }

    const employeeReports = await getEmployeeReports({});
    const rEmp1 = employeeReports.find(e => e.employeeCode === emp1.employeeCode) || { customers: 0, loans: 0, outstanding: 0 };
    const rEmp2 = employeeReports.find(e => e.employeeCode === emp2.employeeCode) || { customers: 0, loans: 0, outstanding: 0 };

    const sumCustomers = rEmp1.customers + rEmp2.customers;
    const sumLoans = rEmp1.loans + rEmp2.loans;
    const sumOutstanding = rEmp1.outstanding + rEmp2.outstanding;

    console.log(`\n--- Verification for Area ${area} ---`);
    console.log(`Area Customers: ${myArea.customers} (Sum: ${sumCustomers})`);
    console.log(`Area Loans: ${myArea.loans} (Sum: ${sumLoans})`);
    console.log(`Area Outstanding: ${myArea.outstanding} (Sum: ${sumOutstanding})`);
    
    if (
      myArea.customers === sumCustomers &&
      myArea.loans === sumLoans &&
      myArea.outstanding === sumOutstanding &&
      myArea.customers === 2 &&
      myArea.outstanding === 330
    ) {
      console.log('✅ PASS: Area totals equal sum of employees in that area.');
    } else {
      console.log('❌ FAIL: Area totals mismatch.');
    }
    
    // Cleanup
    await Employee.deleteMany({ _id: { $in: [emp1._id, emp2._id] } });
    await Customer.deleteMany({ _id: { $in: [cust1._id, cust2._id] } });
    await Loan.deleteMany({ _id: { $in: [loan1._id, loan2._id] } });
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
