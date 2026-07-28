const mongoose = require('mongoose');

const loanScheduleSchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true,
    index: true
  },
  dayNumber: {
    type: Number,
    required: true,
    min: 1
  },
  date: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'MISSED'],
    default: 'PENDING',
    index: true
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidDate: {
    type: Date
  },
  remarks: {
    type: String
  }
}, { timestamps: true });

// Compound index for quick querying of a specific day for a specific loan
loanScheduleSchema.index({ loanId: 1, dayNumber: 1 }, { unique: true });

module.exports = mongoose.model('LoanSchedule', loanScheduleSchema);
