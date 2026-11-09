const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  recipientId: mongoose.Schema.Types.ObjectId, role: String,
  notificationId: mongoose.Schema.Types.ObjectId, auditId: mongoose.Schema.Types.ObjectId,
  day: String, kind: String, cutoffChecked: Boolean,
  status: { type: String, default: 'PENDING', enum: ['PENDING','SENDING','SENT','SKIPPED','FAILED','UNCERTAIN'] },
  attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now },
  lockedAt: Date, sentAt: Date, reason: String
}, { timestamps: true });
schema.index({status:1,nextAttemptAt:1});
schema.index({notificationId:1});schema.index({auditId:1});
module.exports = mongoose.model('EmailJob', schema);
