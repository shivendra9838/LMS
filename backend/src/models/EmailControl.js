const mongoose = require('mongoose');
module.exports = mongoose.model('EmailControl', new mongoose.Schema({
  _id: String, startedAt: Date
}));
