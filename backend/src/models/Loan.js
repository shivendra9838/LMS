const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  loanNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
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
  loanAmount: {
    type: Number,
    required: true,
    min: 1
  },
  interestPercent: {
    type: Number,
    required: true,
    min: 0
  },
  interestAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalPayable: {
    type: Number,
    required: true,
    min: 0
  },
  durationDays: {
    type: Number,
    required: true,
    min: 1
  },
  dailyInstallment: {
    type: Number,
    required: true,
    min: 0
  },
  loanDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  maturityDate: {
    type: Date,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paidDays: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingDays: {
    type: Number,
    required: true,
    min: 0
  },
  lastPaymentDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'CLOSED', 'DEFAULTED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
