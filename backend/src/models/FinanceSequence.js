const mongoose = require('mongoose');
module.exports = mongoose.model('FinanceSequence', new mongoose.Schema({ _id: String, value: { type: Number, required: true } }));
