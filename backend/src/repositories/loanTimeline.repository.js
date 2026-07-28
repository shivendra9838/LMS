const LoanTimeline = require('../models/LoanTimeline');

const createLoanTimelineEntry = async (loanId, action, description) => {
  return await LoanTimeline.create({ loanId, action, description });
};

const getLoanTimeline = async (loanId) => {
  return await LoanTimeline.find({ loanId }).sort({ date: -1 }).lean();
};

module.exports = {
  createLoanTimelineEntry,
  getLoanTimeline
};
