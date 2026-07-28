const Loan = require('../models/Loan');
const Customer = require('../models/Customer');

const getAdminDashboardStats = async () => {
  const [loanStats] = await Loan.aggregate([
    {
      $group: {
        _id: null,
        totalLoans: { $sum: 1 },
        activeLoans: {
          $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
        },
        completedLoans: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
        },
        cancelledLoans: {
          $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
        },
        totalLoanAmount: { $sum: '$loanAmount' },
        avgLoanAmount: { $avg: '$loanAmount' }
      }
    }
  ]);

  return loanStats || {
    totalLoans: 0,
    activeLoans: 0,
    completedLoans: 0,
    cancelledLoans: 0,
    totalLoanAmount: 0,
    avgLoanAmount: 0
  };
};

const getEmployeeDashboardStats = async (employeeId) => {
  const [loanStats] = await Loan.aggregate([
    { $match: { employeeId } },
    {
      $group: {
        _id: null,
        myLoans: { $sum: 1 },
        totalOutstanding: { $sum: '$remainingAmount' }
      }
    }
  ]);

  const customerCount = await Customer.countDocuments({ employeeId, status: 'ACTIVE' });

  return {
    myLoans: loanStats ? loanStats.myLoans : 0,
    totalOutstanding: loanStats ? loanStats.totalOutstanding : 0,
    customers: customerCount,
    todaysCollections: 0 // Hardcoded for Phase 6
  };
};

module.exports = {
  getAdminDashboardStats,
  getEmployeeDashboardStats
};
