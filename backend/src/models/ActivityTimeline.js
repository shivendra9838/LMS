const mongoose = require('mongoose');

const activityTimelineSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['CUSTOMER', 'EMPLOYEE', 'ADMIN', 'LOAN'],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'performerModel'
  },
  performerModel: {
    type: String,
    enum: ['Admin', 'Employee', 'SYSTEM'],
    default: 'Admin'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

activityTimelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityTimeline', activityTimelineSchema);
