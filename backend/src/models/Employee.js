const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  address: {type:String,maxlength:500},
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
  authVersion: { type: Number, default: 0, select: false },
  passwordReset: {
    type: new mongoose.Schema({
      tokenHash: String,
      expiresAt: Date,
      requestedAt: Date
    }, { _id: false }),
    select: false
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
employeeSchema.index({branchId:1,status:1,name:1,_id:1},{collation:{locale:'en',strength:2},name:'portfolio_employee_directory'});
for(const field of ['name','employeeCode','phone'])employeeSchema.index({[field]:1,_id:1},{collation:{locale:'en',strength:2},name:`portfolio_employee_search_${field}`});

employeeSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  this.password = await hashPassword(this.password);
});

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;
