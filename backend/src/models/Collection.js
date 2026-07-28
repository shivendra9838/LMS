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
    default: Date.now
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'],
    default: 'CASH'
  },
  status: {
    type: String,
    enum: ['PAID', 'PARTIAL', 'MISSED', 'EXTRA_PAYMENT', 'WAIVED'],
    required: true
  },
  remarks: {
    type: String,
    trim: true
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // or Admin, but usually Employee who collected it
    required: true
  }
}, { timestamps: true });

// Add compound indexes for fast querying of daily collections
collectionSchema.index({ employeeId: 1, paymentDate: 1 });
collectionSchema.index({ customerId: 1, paymentDate: 1 });

const Collection = mongoose.model('Collection', collectionSchema);

module.exports = Collection;
