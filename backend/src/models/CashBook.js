const mongoose = require('mongoose');

const cashBookEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['LOAN_RECOVERY', 'MANUAL_INCOME', 'NEW_LOAN', 'OFFICE_EXPENSE', 'SALARY', 'MISC'],
    required: true
  },
  direction: {
    type: String,
    enum: ['CASH_IN', 'CASH_OUT'],
    required: true
  },
  cashIn: {
    type: Number,
    default: 0,
    min: 0
  },
  cashOut: {
    type: Number,
    default: 0,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  referenceModel: {
    type: String,
    enum: ['Loan', 'Collection', 'Expense', 'Manual']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  transactionKey: {
    type: String,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByModel'
  },
  createdByModel: {
    type: String,
    enum: ['Admin', 'Employee', 'SYSTEM'],
    default: 'Admin'
  }
}, { timestamps: true });

const cashBookSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  openingBalance: {
    type: Number,
    required: true,
    default: 0
  },
  cashIn: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  cashOut: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  closingBalance: {
    type: Number,
    required: true,
    default: 0
  },
  entries: [cashBookEntrySchema]
}, { timestamps: true });

module.exports = mongoose.model('CashBook', cashBookSchema);
