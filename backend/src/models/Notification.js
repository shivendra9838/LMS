const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  loanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  loanScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanSchedule'
  },
  type: {
    type: String,
    enum: ['MISSED_PAYMENT', 'GENERAL'],
    default: 'MISSED_PAYMENT'
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['UNREAD', 'READ'],
    default: 'UNREAD'
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
