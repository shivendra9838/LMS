const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'ADMIN',
    enum: ['ADMIN']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const { hashPassword } = require('../utils/password');

adminSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  this.password = await hashPassword(this.password);
});

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
