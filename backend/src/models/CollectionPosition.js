const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true, unique: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  area: String,
  paymentDate: { type: Date, required: true },
  recordedAt: { type: Date, immutable: true },
  method: { type: String, enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'], required: true },
  bucket: { type: String, enum: ['CASH', 'UPI_EMPLOYEE', 'BANK_EMPLOYEE', 'COMPANY_DIGITAL', 'UNCLASSIFIED'], required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount' },
  reference: String,
  amountMinor: { type: Number, required: true, min: 0 },
  reservedMinor: { type: Number, default: 0, min: 0 },
  settledMinor: { type: Number, default: 0, min: 0 },
  verification: { type: String, enum: ['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'DISPUTED'], required: true },
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceEvidence' },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  version: { type: Number, default: 1 }
}, { timestamps: true });
schema.index({ employeeId: 1, bucket: 1, paymentDate: 1 });
schema.index({ verification: 1, paymentDate: 1 });
module.exports = mongoose.model('CollectionPosition', schema);
