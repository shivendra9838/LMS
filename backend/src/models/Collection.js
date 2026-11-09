const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  collectionNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true,
    index: true
  },
  loanScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanSchedule',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  amountReceived: {
    type: Number,
    required: true,
    min: 0
  },
  expectedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'],
    default: 'CASH'
  },
  status: {
    type: String,
    enum: ['PAID', 'PARTIAL', 'MISSED', 'EXTRA_PAYMENT', 'WAIVED'],
    required: true,
    index: true
  },
  remarks: {
    type: String,
    trim: true
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // or Admin, but usually Employee who collected it
    required: true
  },
  financeVersion: Number,
  backdateReason: { type: String, maxlength: 1000 },
  allocations: [{
    _id: false,
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanSchedule', required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0.01 }
  }],
  receivingAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount' },
  receivingDestination: { type: String, enum: ['EMPLOYEE', 'COMPANY', 'UNCLASSIFIED'] },
  transactionReference: String,
  recordedByRole: { type: String, enum: ['ADMIN', 'EMPLOYEE', 'SYSTEM'] },
  idempotencyActor: String,
  idempotencyKey: String,
  requestHash: { type: String, select: false }
}, { timestamps: true });

// Add compound indexes for fast querying of daily collections
collectionSchema.index({ employeeId: 1, paymentDate: 1 });
collectionSchema.index({ customerId: 1, paymentDate: 1 });
collectionSchema.index({ idempotencyActor: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
collectionSchema.index({customerId:1,paymentDate:-1,_id:-1},{name:'portfolio_customer_receipts'});
collectionSchema.index({paymentDate:1,loanId:1},{name:'dashboard_receipt_period'});

const Collection = mongoose.model('Collection', collectionSchema);

module.exports = Collection;
