const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  category: {
    type: String,
    enum: ['OFFICE_EXPENSE', 'SALARY', 'MISC'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  paidTo: {
    type: String,
    trim: true
  },
  paymentMode: {
    type: String,
    enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'],
    default: 'CASH'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DELETED'],
    default: 'ACTIVE',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
