const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  label: { type: String, required: true, maxlength: 100 },
  owner: { type: String, enum: ['COMPANY', 'EMPLOYEE'], required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  modes: [{ type: String, enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'] }],
  maskedDetails: { type: String, maxlength: 30 },
  encryptedDetails: { type: Buffer, select: false },
  detailsFingerprint: { type: String, select: false },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }
}, { timestamps: true });
schema.index({ owner: 1, employeeId: 1, active: 1 });
schema.index({ detailsFingerprint: 1 }, { unique: true, partialFilterExpression: { detailsFingerprint: { $type: 'string' } } });
module.exports = mongoose.model('PaymentAccount', schema);
