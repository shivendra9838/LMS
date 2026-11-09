const mongoose = require('mongoose');
const allocation = new mongoose.Schema({ positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionPosition', required: true }, amountMinor: { type: Number, required: true } }, { _id: false });
const schema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  kind: { type: String, enum: ['CASH', 'DIGITAL'], required: true },
  amountMinor: { type: Number, required: true, min: 1 },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount', required: true },
  sourceAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount' },
  reference: { type: String, required: true },
  occurredAt: { type: Date, required: true },
  status: { type: String, enum: ['SUBMITTED', 'VERIFIED', 'REJECTED', 'DISPUTED', 'REVERSED'], default: 'SUBMITTED' },
  allocations: [allocation],
  remarks: { type: String, maxlength: 1000 },
  idempotencyKey: { type: String, required: true },
  requestHash: { type: String, required: true },
  supersedesId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSettlement' },
  correctionRootId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSettlement' },
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceEvidence' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: Date,
  verifiedAt: Date,
  reviewRemarks: String,
  observedMinor: Number,
  differenceMinor: Number,
  version: { type: Number, default: 1 }
}, { timestamps: true });
schema.index({ employeeId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ employeeId: 1, status: 1, occurredAt: -1 });
schema.index({ supersedesId: 1 }, { unique: true, partialFilterExpression: { supersedesId: { $type: 'objectId' } } });
module.exports = mongoose.model('EmployeeSettlement', schema);
