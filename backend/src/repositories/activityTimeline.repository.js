const ActivityTimeline = require('../models/ActivityTimeline');
const mongoose = require('mongoose');

const getTimelineByEntity = async (entityType, entityId) => {
  const query = { entityType };
  if (entityId) {
    query.entityId = new mongoose.Types.ObjectId(entityId);
  }

  return await ActivityTimeline.find(query)
    .sort({ createdAt: -1 })
    .populate('performedBy', 'name email role employeeCode')
    .lean();
};

const getAdminTimeline = async () => {
  return await ActivityTimeline.find({ entityType: 'ADMIN' })
    .sort({ createdAt: -1 })
    .populate('performedBy', 'name email role')
    .lean();
};

module.exports = {
  getTimelineByEntity,
  getAdminTimeline
};
