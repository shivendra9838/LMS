const LoanSchedule = require('../models/LoanSchedule');
const Collection = require('../models/Collection');
const mongoose = require('mongoose');

const getDailyReports = async (filters) => {
  const { date, employeeId, area, city } = filters;

  const matchStage = {};
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    matchStage.date = { $gte: d, $lte: end };
  }

  // Lookup Loan to apply Employee/Area/City filters
  const lookupLoan = {
    $lookup: {
      from: 'loans',
      localField: 'loanId',
      foreignField: '_id',
      as: 'loan'
    }
  };
  
  const lookupCustomer = {
    $lookup: {
      from: 'customers',
      localField: 'loan.customerId',
      foreignField: '_id',
      as: 'customer'
    }
  };

  const loanMatchStage = {};
  if (employeeId) loanMatchStage['loan.employeeId'] = new mongoose.Types.ObjectId(employeeId);
  
  const customerMatchStage = {};
  if (area) customerMatchStage['customer.area'] = area;
  if (city) customerMatchStage['customer.city'] = city;

  // We want to group by Date
  // But wait, LoanSchedule's date is a full timestamp. We need to format it to YYYY-MM-DD.
  const pipeline = [
    { $match: matchStage },
    lookupLoan,
    { $unwind: '$loan' },
    ...(Object.keys(loanMatchStage).length > 0 ? [{ $match: loanMatchStage }] : []),
    lookupCustomer,
    { $unwind: '$customer' },
    ...(Object.keys(customerMatchStage).length > 0 ? [{ $match: customerMatchStage }] : []),
    
    // Group by Date string
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        totalDueCount: { $sum: 1 },
        totalDueAmount: { $sum: '$amount' },
        collectedCount: { $sum: { $cond: [{ $in: ['$status', ['PAID', 'PARTIAL']] }, 1, 0] } },
        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        missedCount: { $sum: { $cond: [{ $eq: ['$status', 'MISSED'] }, 1, 0] } },
        collectionAmount: { $sum: '$paidAmount' }
      }
    },
    { $sort: { _id: -1 } },
    {
      $project: {
        date: '$_id',
        totalDue: '$totalDueCount',
        collected: '$collectedCount',
        pending: '$pendingCount',
        missed: '$missedCount',
        collectionAmount: '$collectionAmount',
        collectionPercentage: {
          $cond: [
            { $gt: ['$totalDueAmount', 0] },
            { $multiply: [{ $divide: ['$collectionAmount', '$totalDueAmount'] }, 100] },
            0
          ]
        },
        _id: 0
      }
    }
  ];

  return await LoanSchedule.aggregate(pipeline);
};
const getEmployeeReports = async (filters) => {
  const Employee = require('../models/Employee');
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const pipeline = [
    { $match: { role: 'EMPLOYEE' } },
    // Lookup Customers
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: 'employeeId',
        as: 'customers'
      }
    },
    // Lookup Loans
    {
      $lookup: {
        from: 'loans',
        localField: '_id',
        foreignField: 'employeeId',
        as: 'loans'
      }
    },
    // Lookup Today's Schedules for the employee's loans
    {
      $lookup: {
        from: 'loanschedules',
        let: { empId: '$_id' },
        pipeline: [
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
            $match: {
              $expr: { $eq: ['$loan.employeeId', '$$empId'] },
              date: { $gte: startOfDay, $lte: endOfDay }
            }
          }
        ],
        as: 'todaysSchedules'
      }
    },
    {
      $project: {
        employeeCode: 1,
        name: 1,
        customersCount: { $size: '$customers' },
        activeLoansCount: {
          $size: {
            $filter: {
              input: '$loans',
              as: 'loan',
              cond: { $eq: ['$$loan.status', 'ACTIVE'] }
            }
          }
        },
        totalOutstanding: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$loans',
                  as: 'loan',
                  cond: { $eq: ['$$loan.status', 'ACTIVE'] }
                }
              },
              as: 'loan',
              in: '$$loan.remainingAmount'
            }
          }
        },
        // Calculate Today's metrics from schedules
        todaysDueAmount: { $sum: '$todaysSchedules.amount' },
        todaysCollectionAmount: { $sum: '$todaysSchedules.paidAmount' },
        pendingCount: {
          $size: {
            $filter: {
              input: '$todaysSchedules',
              as: 'sch',
              cond: { $eq: ['$$sch.status', 'PENDING'] }
            }
          }
        },
        missedCount: {
          $size: {
            $filter: {
              input: '$todaysSchedules',
              as: 'sch',
              cond: { $eq: ['$$sch.status', 'MISSED'] }
            }
          }
        }
      }
    },
    {
      $project: {
        employeeCode: 1,
        name: 1,
        customers: '$customersCount',
        loans: '$activeLoansCount',
        todaysCollection: '$todaysCollectionAmount',
        pending: '$pendingCount',
        missed: '$missedCount',
        outstanding: '$totalOutstanding',
        collectionEfficiency: {
          $cond: [
            { $gt: ['$todaysDueAmount', 0] },
            { $multiply: [{ $divide: ['$todaysCollectionAmount', '$todaysDueAmount'] }, 100] },
            0
          ]
        },
        _id: 0
      }
    }
  ];

  return await Employee.aggregate(pipeline);
};
const getAreaReports = async (filters) => {
  const Customer = require('../models/Customer');
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const pipeline = [
    {
      $group: {
        _id: { city: '$city', area: '$area' },
        customers: { $sum: 1 },
        customerIds: { $push: '$_id' }
      }
    },
    {
      $lookup: {
        from: 'loans',
        localField: 'customerIds',
        foreignField: 'customerId',
        as: 'loans'
      }
    },
    {
      $lookup: {
        from: 'loanschedules',
        let: { loanIds: '$loans._id' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$loanId', '$$loanIds'] },
              date: { $gte: startOfDay, $lte: endOfDay }
            }
          }
        ],
        as: 'todaysSchedules'
      }
    },
    {
      $project: {
        city: '$_id.city',
        area: '$_id.area',
        customers: 1,
        loans: {
          $size: {
            $filter: {
              input: '$loans',
              as: 'loan',
              cond: { $eq: ['$$loan.status', 'ACTIVE'] }
            }
          }
        },
        outstanding: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$loans',
                  as: 'loan',
                  cond: { $eq: ['$$loan.status', 'ACTIVE'] }
                }
              },
              as: 'loan',
              in: '$$loan.remainingAmount'
            }
          }
        },
        todaysCollection: { $sum: '$todaysSchedules.paidAmount' },
        pending: {
          $size: {
            $filter: {
              input: '$todaysSchedules',
              as: 'sch',
              cond: { $eq: ['$$sch.status', 'PENDING'] }
            }
          }
        },
        missed: {
          $size: {
            $filter: {
              input: '$todaysSchedules',
              as: 'sch',
              cond: { $eq: ['$$sch.status', 'MISSED'] }
            }
          }
        },
        _id: 0
      }
    },
    { $sort: { city: 1, area: 1 } }
  ];

  return await Customer.aggregate(pipeline);
};
const getOutstandingReports = async (filters) => {
  const Loan = require('../models/Loan');
  const mongoose = require('mongoose');

  const { area, employeeId, status, minOutstanding, maxOutstanding } = filters;
  const matchStage = {};

  if (employeeId) matchStage.employeeId = new mongoose.Types.ObjectId(employeeId);
  if (status) matchStage.status = status;
  
  if (minOutstanding || maxOutstanding) {
    matchStage.remainingAmount = {};
    if (minOutstanding) matchStage.remainingAmount.$gte = Number(minOutstanding);
    if (maxOutstanding) matchStage.remainingAmount.$lte = Number(maxOutstanding);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer'
      }
    },
    { $unwind: '$customer' },
    {
      $lookup: {
        from: 'employees',
        localField: 'employeeId',
        foreignField: '_id',
        as: 'employee'
      }
    },
    { $unwind: '$employee' },
    // Filter by area on customer level
    ...(area ? [{ $match: { 'customer.area': area } }] : []),
    {
      $project: {
        loanNumber: 1,
        customerName: '$customer.name',
        employeeName: '$employee.name',
        area: '$customer.area',
        outstandingAmount: '$remainingAmount',
        remainingDays: 1,
        status: 1,
        // Optional: you could lookup the most recent collection for lastPaymentDate
        // but Loan model might already have a lastPaymentDate or we can compute it if needed
        lastPayment: '$lastPaymentDate', // ensure this exists or update accordingly
        _id: 0
      }
    },
    { $sort: { outstandingAmount: -1 } }
  ];

  return await Loan.aggregate(pipeline);
};

const getCollectionReports = async (filters) => {
  const Collection = require('../models/Collection');

  const { startDate, endDate, period } = filters;
  const matchStage = {};

  if (startDate && endDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    matchStage.paymentDate = { $gte: s, $lte: e };
  } else if (period) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    
    if (period === 'today') {
      // Keep today's date
    } else if (period === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (period === 'this_week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start.setDate(diff);
    } else if (period === 'this_month') {
      start.setDate(1);
    }
    matchStage.paymentDate = { $gte: start, $lte: end };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCollections: { $sum: 1 },
        totalAmount: { $sum: '$amountReceived' },
        cashCount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'CASH'] }, 1, 0] } },
        cashAmount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'CASH'] }, '$amountReceived', 0] } },
        upiCount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'UPI'] }, 1, 0] } },
        upiAmount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'UPI'] }, '$amountReceived', 0] } },
        bankTransferCount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'BANK_TRANSFER'] }, 1, 0] } },
        bankTransferAmount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'BANK_TRANSFER'] }, '$amountReceived', 0] } },
        chequeCount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'CHEQUE'] }, 1, 0] } },
        chequeAmount: { $sum: { $cond: [{ $eq: ['$paymentMode', 'CHEQUE'] }, '$amountReceived', 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalCollections: 1,
        totalAmount: 1,
        breakdown: {
          cash: { count: '$cashCount', amount: '$cashAmount' },
          upi: { count: '$upiCount', amount: '$upiAmount' },
          bankTransfer: { count: '$bankTransferCount', amount: '$bankTransferAmount' },
          cheque: { count: '$chequeCount', amount: '$chequeAmount' }
        }
      }
    }
  ];

  const result = await Collection.aggregate(pipeline);
  return result.length > 0 ? result[0] : {
    totalCollections: 0, totalAmount: 0,
    breakdown: {
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      bankTransfer: { count: 0, amount: 0 },
      cheque: { count: 0, amount: 0 }
    }
  };
};

const getExportData = async (type, filters) => {
  const mongoose = require('mongoose');
  
  if (['daily', 'monthly', 'collections'].includes(type)) {
    const Collection = require('../models/Collection');
    // Common collection export pipeline
    const pipeline = [
      {
        $lookup: {
          from: 'loans', localField: 'loanId', foreignField: '_id', as: 'loan'
        }
      },
      { $unwind: { path: '$loan', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee'
        }
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          loanNumber: '$loan.loanNumber',
          customer: '$customer.name',
          employee: '$employee.name',
          area: '$customer.area',
          expectedAmount: 1,
          receivedAmount: '$amountReceived',
          status: 1,
          paymentMode: 1,
          date: '$paymentDate'
        }
      },
      { $sort: { date: -1 } }
    ];
    return await Collection.aggregate(pipeline);
  }
  
  if (type === 'outstanding' || type === 'loans') {
    const Loan = require('../models/Loan');
    const pipeline = [
      {
        $lookup: {
          from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee'
        }
      },
      { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          loanNumber: 1,
          customer: '$customer.name',
          employee: '$employee.name',
          area: '$customer.area',
          loanAmount: 1,
          remainingAmount: 1,
          status: 1,
          loanDate: 1
        }
      },
      { $sort: { loanDate: -1 } }
    ];
    return await Loan.aggregate(pipeline);
  }
  
  if (type === 'customers') {
    const Customer = require('../models/Customer');
    return await Customer.find({}, { _id: 0, customerCode: 1, name: 1, mobile: 1, city: 1, area: 1, status: 1 }).lean();
  }
  
  if (type === 'employees') {
    const Employee = require('../models/Employee');
    return await Employee.find({ role: 'EMPLOYEE' }, { _id: 0, employeeCode: 1, name: 1, phone: 1, city: 1, area: 1, status: 1 }).lean();
  }
  
  return [];
};

module.exports = {
  getDailyReports,
  getEmployeeReports,
  getAreaReports,
  getOutstandingReports,
  getCollectionReports,
  getExportData
};
