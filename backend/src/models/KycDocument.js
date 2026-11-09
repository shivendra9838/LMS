const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerLead', required: true, index: true },
  kind: { type: String, enum: ['PHOTO', 'IDENTITY', 'ADDRESS', 'BUSINESS', 'INCOME', 'SIGNATURE'], required: true },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  digest: { type: String, required: true },
  encryptedBytes: { type: Buffer, required: true, select: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }
}, { timestamps: true });
module.exports = mongoose.model('KycDocument', schema);
