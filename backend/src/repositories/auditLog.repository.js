const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

const getAuditLogs = async (filters = {}) => {
  const { userId, action, module, startDate, endDate, search, page = 1, limit = 50 } = filters;
  const query = {};

  if (userId) {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = new mongoose.Types.ObjectId(userId);
    }
  }

  if (action) query.action = action;
  if (module) query.module = module;
  if (search) {
    query.$or = [
      { action: new RegExp(search, 'i') },
      { module: new RegExp(search, 'i') },
      { referenceId: new RegExp(search, 'i') },
      { userRole: new RegExp(search, 'i') }
    ];
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      query.createdAt.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      query.createdAt.$lte = e;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'name email phone role')
      .lean(),
    AuditLog.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    }
  };
};

module.exports = {
  getAuditLogs
};
