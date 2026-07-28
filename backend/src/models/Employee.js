const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  employeeCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    index: true
  },
  area: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'EMPLOYEE',
    enum: ['EMPLOYEE']
  },
  status: {
    type: String,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'INACTIVE']
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true
});

const { hashPassword } = require('../utils/password');

employeeSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  this.password = await hashPassword(this.password);
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
