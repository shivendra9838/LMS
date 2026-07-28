const LoanSchedule = require('../models/LoanSchedule');
const mongoose = require('mongoose');

const getTodayCollectionsForEmployee = async (employeeId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const pipeline = [
    {
      $match: {
        date: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $lookup: {
        from: 'loans',
        localField: 'loanId',
        foreignField: '_id',
        as: 'loan'
      }
    },
    {
      $unwind: '$loan'
    },
    {
      $match: {
        'loan.employeeId': new mongoose.Types.ObjectId(employeeId),
        'loan.status': 'ACTIVE'
      }
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'loan.customerId',
        foreignField: '_id',
        as: 'customer'
      }
    },
    {
      $unwind: '$customer'
    },
    {
      $project: {
        _id: 1,
        loanScheduleId: '$_id',
        loanId: '$loan._id',
        customerId: '$customer._id',
        customerName: '$customer.name',
        customerCode: '$customer.customerCode',
        loanNumber: '$loan.loanNumber',
        dayNumber: '$dayNumber',
        amount: '$amount',
        paidAmount: '$paidAmount',
        dueDate: '$date',
        status: 1
      }
    },
    {
      $sort: { customerName: 1 }
    }
  ];

  return await LoanSchedule.aggregate(pipeline);
};

const getCollectionHistoryForLoan = async (loanId) => {
  const Collection = require('../models/Collection'); // require dynamically or at top
  return await Collection.find({ loanId })
    .populate('loanScheduleId', 'dayNumber date')
    .populate('collectedBy', 'name employeeCode')
    .sort({ createdAt: -1 });
};

module.exports = {
  getTodayCollectionsForEmployee,
  getCollectionHistoryForLoan
};
