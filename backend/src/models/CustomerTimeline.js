const mongoose = require('mongoose');

const customerTimelineSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('CustomerTimeline', customerTimelineSchema);
