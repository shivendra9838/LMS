const Loan = require('../models/Loan');

// Scaffold repository
const createLoan = async (loanData) => {
  return await Loan.create(loanData);
};

const getLoans = async (query, skip, limit, sort) => {
  const [loans, total] = await Promise.all([
    Loan.find(query)
      .populate('customerId', 'name customerCode mobile')
      .populate('employeeId', 'name employeeCode')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Loan.countDocuments(query)
  ]);
  return { loans, total };
};

const getLoanById = async (id) => {
  return await Loan.findById(id)
    .populate('customerId', 'name customerCode mobile')
    .populate('employeeId', 'name employeeCode city branch')
    .lean();
};

const updateLoanStatus = async (id, status) => {
  return await Loan.findByIdAndUpdate(id, { status }, { new: true });
};

// Custom queries
const getActiveLoanByCustomerId = async (customerId) => {
  return await Loan.findOne({ customerId, status: 'ACTIVE' }).lean();
};

module.exports = {
  createLoan,
  getLoans,
  getLoanById,
  updateLoanStatus,
  getActiveLoanByCustomerId
};
