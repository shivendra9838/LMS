const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  kycLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerLead', index: true },
  kycApprovedAt: Date,
  customerCode: {
    type: String,
    required: true,
    unique: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  fatherName: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  alternateMobile: {
    type: String
  },
  age: {
    type: Number,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  occupation: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    index: true
  },
  area: {
    type: String,
    required: true,
    index: true
  },
  landmark: {
    type: String
  },
  idProofType: {
    type: String,
    enum: ['Aadhar', 'PAN', 'VoterID', 'DrivingLicense', 'Passport']
  },
  idProofNumber: {
    type: String
  },
  photo: {
    type: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, { timestamps: true });

customerSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { kycLeadId: { $exists: true } }, name: 'unique_kyc_customer_mobile' });
customerSchema.index({employeeId:1,name:1,_id:1},{collation:{locale:'en',strength:2},name:'portfolio_owner_name'});
for(const field of ['name','customerCode','mobile'])customerSchema.index({[field]:1,_id:1},{collation:{locale:'en',strength:2},name:`portfolio_search_${field}`});
module.exports = mongoose.model('Customer', customerSchema);
