const mongoose = require('mongoose');

const customerLeadSchema = new mongoose.Schema({
  submittedByEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  name: { type: String, required: function () { return !this.kycVersion; } },
  fatherName: { type: String, required: function () { return !this.kycVersion; } },
  mobile: { type: String, required: function () { return !this.kycVersion; }, index: true },
  alternateMobile: { type: String },
  age: { type: Number, required: function () { return !this.kycVersion; } },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  occupation: { type: String, required: function () { return !this.kycVersion; } },
  address: { type: String, required: function () { return !this.kycVersion; } },
  city: { type: String, required: function () { return !this.kycVersion; } },
  area: { type: String, required: function () { return !this.kycVersion; } },
  landmark: { type: String },
  idProofType: {
    type: String,
    enum: ['Aadhar', 'PAN', 'VoterID', 'DrivingLicense', 'Passport']
  },
  idProofNumber: { type: String },
  employeeNotes: { type: String, trim: true },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'],
    default: 'PENDING',
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  assignedEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminRemarks: { type: String, trim: true },
  employeeVerificationId: {type:mongoose.Schema.Types.ObjectId,ref:'KycVerificationSignature'},
  kycApprovalId: {type:mongoose.Schema.Types.ObjectId,ref:'KycApproval'},
  kycVersion: Number,
  kycEncrypted: { type: Buffer, select: false },
  approvedKycEncrypted: { type: Buffer, select: false },
  documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KycDocument' }],
  approvedDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KycDocument' }],
  approvedAt: Date,
  history: [{
    action: String,
    actorId: mongoose.Schema.Types.ObjectId,
    role: String,
    at: { type: Date, default: Date.now },
    fields: [String],
    reason: String
  }]
}, { timestamps: true, optimisticConcurrency: true });

customerLeadSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { kycVersion: 1, status: 'PENDING' }, name: 'unique_pending_kyc_mobile' });
module.exports = mongoose.model('CustomerLead', customerLeadSchema);
