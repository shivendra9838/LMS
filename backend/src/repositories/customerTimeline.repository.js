const CustomerTimeline = require('../models/CustomerTimeline');

const createTimelineEntry = async (customerId, action, details) => {
  const entry = new CustomerTimeline({ customerId, action, details });
  return await entry.save();
};

const getTimelineByCustomerId = async (customerId) => {
  return await CustomerTimeline.find({ customerId }).sort({ createdAt: -1 });
};

module.exports = { createTimelineEntry, getTimelineByCustomerId };
