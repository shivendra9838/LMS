const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  targetType: { type: String, enum: ['Settlement', 'Position'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  correctionRootId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSettlement' },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  source: { type: String, enum: ['EMPLOYEE_PROOF', 'BANK_STATEMENT', 'UPI_PROVIDER', 'BANK_STATEMENT_SUPPLEMENT', 'UPI_PROVIDER_SUPPLEMENT', 'CASH_COUNT'], required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount' },
  reference: String,
  amountMinor: Number,
  observedAt: Date,
  note: { type: String, maxlength: 1000 },
  mime: String,
  digest: String,
  encryptedBytes: { type: Buffer, select: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['ADMIN', 'EMPLOYEE'], required: true }
}, { timestamps: true });
// One company bank statement transaction cannot confirm two different postings.
schema.index({ accountId: 1, reference: 1 }, { unique: true, partialFilterExpression: { source: { $in: ['BANK_STATEMENT', 'UPI_PROVIDER'] } } });
module.exports = mongoose.model('FinanceEvidence', schema);
