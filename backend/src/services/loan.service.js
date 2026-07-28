const { createLoan, getLoans, getLoanById, updateLoanStatus, getActiveLoanByCustomerId } = require('../repositories/loan.repository');
const { getCustomerByIdService } = require('./customer.service');
const Employee = require('../models/Employee');
const { calculateLoanDetails } = require('../utils/loanCalculator');
const { generateLoanNumber } = require('../utils/generateCode');
const { createTimelineEntry } = require('../repositories/customerTimeline.repository');
const { createLoanTimelineEntry } = require('../repositories/loanTimeline.repository');
const { createBulkSchedules } = require('../repositories/loanSchedule.repository');
const Customer = require('../models/Customer');

const createLoanService = async (loanData, user) => {
  const { customerId, loanAmount, interestPercent, durationDays, loanDate } = loanData;

  // 1. Validate Customer & Check Ownership (Handled natively by getCustomerByIdService)
  // This throws a 404 if the customer doesn't belong to the employee
  const customer = await getCustomerByIdService(customerId, user);

  // 2. Check Customer Active
  if (customer.status !== 'ACTIVE') {
    const error = new Error('Cannot issue loan to an INACTIVE customer');
    error.status = 400;
    throw error;
  }

  // 3. Check Employee Active
  const employee = await Employee.findById(user.id);
  if (!employee || employee.status !== 'ACTIVE') {
    const error = new Error('Your employee account is INACTIVE. Contact Admin.');
    error.status = 403;
    throw error;
  }

  // 4. Check Existing Active Loan
  const existingActiveLoan = await getActiveLoanByCustomerId(customerId);
  if (existingActiveLoan) {
    const error = new Error('Customer already has an ACTIVE loan');
    error.status = 400;
    throw error;
  }

  // 5. Calculate Math
  const { interestAmount, totalPayable, dailyInstallment } = calculateLoanDetails(loanAmount, interestPercent, durationDays);

  // Calculate maturityDate
  const startDate = new Date(loanDate);
  const maturityDate = new Date(startDate);
  maturityDate.setDate(maturityDate.getDate() + durationDays);

  // 6. Generate Loan Number
  const loanNumber = await generateLoanNumber();

  // 7. Create Loan (Generate Schedule / Schema fields)
  const newLoan = {
    loanNumber,
    customerId,
    employeeId: user.id, // Logged in user issues the loan
    loanAmount,
    interestPercent,
    interestAmount,
    totalPayable,
    durationDays,
    dailyInstallment,
    loanDate: startDate,
    maturityDate,
    paidAmount: 0,
    remainingAmount: totalPayable,
    paidDays: 0,
    remainingDays: durationDays,
    status: 'ACTIVE',
    createdBy: user.id
  };

  const createdLoan = await createLoan(newLoan);

  // 8. Generate Schedule Records
  const schedules = [];
  let currentDate = new Date(startDate);
  for (let day = 1; day <= durationDays; day++) {
    currentDate.setDate(currentDate.getDate() + 1);
    schedules.push({
      loanId: createdLoan._id,
      dayNumber: day,
      date: new Date(currentDate),
      amount: dailyInstallment,
      status: 'PENDING'
    });
  }
  await createBulkSchedules(schedules);

  // 9. Log Timeline Event for Customer
  await createTimelineEntry(
    customerId, 
    'Loan Created', 
    `Loan ${loanNumber} issued for ₹${loanAmount} at ${interestPercent}% for ${durationDays} days.`
  );

  // 10. Log Timeline Event for Loan
  await createLoanTimelineEntry(createdLoan._id, 'Loan Created', 'Loan account opened and verified.');
  await createLoanTimelineEntry(createdLoan._id, 'Schedule Generated', 'Daily payment schedule generated successfully.');

  return createdLoan;
};

const getLoanListService = async (queryParams, user) => {
  const { page = 1, limit = 10, search, employee, customer, status, city, area } = queryParams;
  
  const query = {};

  // Employee RBAC
  if (user.role === 'EMPLOYEE') {
    query.employeeId = user.id;
  } else if (employee) {
    query.employeeId = employee; // Admin can filter by employee
  }

  // Direct filters
  if (customer) query.customerId = customer;
  if (status) query.status = status;
  if (search && search.startsWith('LN')) {
    query.loanNumber = new RegExp(search, 'i');
  }

  // Complex filters requiring Customer lookup (Search by name/mobile or City/Area)
  let customerFilterActive = false;
  const customerQuery = {};
  
  if (city) { customerQuery.city = city; customerFilterActive = true; }
  if (area) { customerQuery.area = area; customerFilterActive = true; }
  
  // If search is not a loan number, assume it's a customer name or mobile
  if (search && !search.startsWith('LN')) {
    customerQuery.$or = [
      { name: new RegExp(search, 'i') },
      { mobile: new RegExp(search, 'i') },
      { customerCode: new RegExp(search, 'i') }
    ];
    customerFilterActive = true;
  }

  if (customerFilterActive) {
    const matchedCustomers = await Customer.find(customerQuery).select('_id').lean();
    const matchedIds = matchedCustomers.map(c => c._id);
    
    if (query.customerId) {
      // If customer was explicitly passed but also searched/filtered, intersect them
      if (!matchedIds.some(id => id.toString() === query.customerId.toString())) {
        query.customerId = null; // Forces empty result
      }
    } else {
      query.customerId = { $in: matchedIds };
    }
  }

  const skip = (page - 1) * limit;
  const { loans, total } = await getLoans(query, skip, parseInt(limit), { createdAt: -1 });

  return {
    loans,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limit)
  };
};

const getLoanByIdService = async (id, user) => {
  const loan = await getLoanById(id);
  
  if (!loan) {
    const error = new Error('Loan not found');
    error.status = 404;
    throw error;
  }

  // Employee RBAC check: Can only view loans assigned to their customers or created by them
  // Actually, since the loan itself has an employeeId, we can just check if loan.employeeId matches user.id
  if (user.role === 'EMPLOYEE' && loan.employeeId._id.toString() !== user.id) {
    const error = new Error('Loan not found'); // Disguised 404
    error.status = 404;
    throw error;
  }

  return loan;
};

const updateLoanStatusService = async (id, status, user) => {
  // Logic will go here
  return {};
};

module.exports = {
  createLoanService,
  getLoanListService,
  getLoanByIdService,
  updateLoanStatusService
};
