const LoanSchedule = require('../models/LoanSchedule');

const createBulkSchedules = async (schedules) => {
  return await LoanSchedule.insertMany(schedules);
};

const getSchedulesByLoanId = async (loanId) => {
  return await LoanSchedule.find({ loanId }).sort({ dayNumber: 1 }).lean();
};

module.exports = {
  createBulkSchedules,
  getSchedulesByLoanId
};
