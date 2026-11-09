const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reference: { type: String, required: true },
  ownerType: { type: String, enum: ['Collection', 'Settlement'], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  claimedAt: { type: Date, default: Date.now }
});
schema.index({ accountId: 1, reference: 1 }, { unique: true });
module.exports = mongoose.model('FinanceReference', schema);
