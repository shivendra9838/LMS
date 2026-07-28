const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const LoanSchedule = require('../models/LoanSchedule');
const Collection = require('../models/Collection');

const getAdminDashboardStats = async () => {
  const Employee = require('../models/Employee');
  
  // Employee Stats
  const [empStats] = await Employee.aggregate([
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        activeEmployees: {
          $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
        }
      }
    }
  ]);

  // Customer Stats
  const [custStats] = await Customer.aggregate([
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        activeCustomers: {
          $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] }
        }
      }
    }
  ]);

  // Loan Stats
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
        totalOutstanding: {
          $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, '$remainingAmount', 0] }
        }
      }
    }
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Today's Schedules Stats
  const [scheduleStats] = await LoanSchedule.aggregate([
    {
      $match: { date: { $gte: startOfDay, $lte: endOfDay } }
    },
    {
      $group: {
        _id: null,
        totalDueAmountToday: { $sum: '$amount' },
        todaysCollection: {
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

  // Today's Collection Amount & Monthly Revenue
  const [collectionStats] = await Collection.aggregate([
    {
      $match: { paymentDate: { $gte: startOfMonth, $lte: endOfDay } }
    },
    {
      $group: {
        _id: null,
        monthlyRevenue: { $sum: '$amountReceived' },
        todaysRevenue: {
          $sum: {
            $cond: [
              { $gte: ['$paymentDate', startOfDay] },
              '$amountReceived',
              0
            ]
          }
        },
        todaysCount: {
          $sum: {
            $cond: [
              { $gte: ['$paymentDate', startOfDay] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const eStats = empStats || { totalEmployees: 0, activeEmployees: 0 };
  const cStats = custStats || { totalCustomers: 0, activeCustomers: 0 };
  const lStats = loanStats || { totalLoans: 0, activeLoans: 0, completedLoans: 0, totalOutstanding: 0 };
  const sStats = scheduleStats || { totalDueAmountToday: 0, todaysCollection: 0, todaysPending: 0, todaysMissed: 0 };
  const colStats = collectionStats || { monthlyRevenue: 0, todaysRevenue: 0, todaysCount: 0 };

  const averageCollection = colStats.todaysCount > 0 ? (colStats.todaysRevenue / colStats.todaysCount) : 0;
  const collectionEfficiency = sStats.totalDueAmountToday > 0 
    ? ((colStats.todaysRevenue / sStats.totalDueAmountToday) * 100) 
    : 0;

  return {
    totalEmployees: eStats.totalEmployees,
    activeEmployees: eStats.activeEmployees,
    totalCustomers: cStats.totalCustomers,
    activeCustomers: cStats.activeCustomers,
    totalLoans: lStats.totalLoans,
    activeLoans: lStats.activeLoans,
    completedLoans: lStats.completedLoans,
    todaysCollection: sStats.todaysCollection,
    todaysPending: sStats.todaysPending,
    todaysMissed: sStats.todaysMissed,
    totalOutstanding: lStats.totalOutstanding,
    todaysRevenue: colStats.todaysRevenue,
    monthlyRevenue: colStats.monthlyRevenue,
    averageCollection: averageCollection,
    collectionEfficiency: collectionEfficiency
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
