const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const LoanSchedule = require('../models/LoanSchedule');
const Collection = require('../models/Collection');

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

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  // Today's Schedules Stats
  const [scheduleStats] = await LoanSchedule.aggregate([
    {
      $match: { date: { $gte: startOfDay, $lte: endOfDay } }
    },
    {
      $group: {
        _id: null,
        totalDueToday: { $sum: 1 },
        collectedToday: {
          $sum: { $cond: [{ $in: ['$status', ['PAID', 'PARTIAL']] }, 1, 0] }
        },
        pendingToday: {
          $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
        },
        missedToday: {
          $sum: { $cond: [{ $eq: ['$status', 'MISSED'] }, 1, 0] }
        }
      }
    }
  ]);

  // Today's Collection Amount
  const [collectionStats] = await Collection.aggregate([
    {
      $match: { paymentDate: { $gte: startOfDay, $lte: endOfDay } }
    },
    {
      $group: {
        _id: null,
        collectionAmountToday: { $sum: '$amountReceived' }
      }
    }
  ]);

  const baseStats = loanStats || {
    totalLoans: 0, activeLoans: 0, completedLoans: 0, cancelledLoans: 0, totalLoanAmount: 0, avgLoanAmount: 0
  };

  const todayStats = scheduleStats || {
    totalDueToday: 0, collectedToday: 0, pendingToday: 0, missedToday: 0
  };

  return {
    ...baseStats,
    ...todayStats,
    collectionAmountToday: collectionStats ? collectionStats.collectionAmountToday : 0
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

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [scheduleStats] = await LoanSchedule.aggregate([
    {
      $match: { date: { $gte: startOfDay, $lte: endOfDay } }
    },
    {
      $lookup: {
        from: 'loans',
        localField: 'loanId',
        foreignField: '_id',
        as: 'loan'
      }
    },
    { $unwind: '$loan' },
    {
      $match: { 'loan.employeeId': employeeId }
    },
    {
      $group: {
        _id: null,
        todaysDue: { $sum: 1 },
        todaysPaid: {
          $sum: { $cond: [{ $in: ['$status', ['PAID', 'PARTIAL']] }, 1, 0] }
        },
        todaysPending: {
          $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
        },
        todaysMissed: {
          $sum: { $cond: [{ $eq: ['$status', 'MISSED'] }, 1, 0] }
        }
      }
    }
  ]);

  const [collectionStats] = await Collection.aggregate([
    {
      $match: { employeeId, paymentDate: { $gte: startOfDay, $lte: endOfDay } }
    },
    {
      $group: {
        _id: null,
        todaysTotalCollection: { $sum: '$amountReceived' }
      }
    }
  ]);

  const todayStats = scheduleStats || {
    todaysDue: 0, todaysPaid: 0, todaysPending: 0, todaysMissed: 0
  };

  return {
    myLoans: loanStats ? loanStats.myLoans : 0,
    totalOutstanding: loanStats ? loanStats.totalOutstanding : 0,
    customers: customerCount,
    ...todayStats,
    todaysTotalCollection: collectionStats ? collectionStats.todaysTotalCollection : 0
  };
};

module.exports = {
  getAdminDashboardStats,
  getEmployeeDashboardStats
};
