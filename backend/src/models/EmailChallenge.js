const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String, requestId: {type:String,index:true}, accountId: mongoose.Schema.Types.ObjectId, role: String,
  purpose: String, emailHash: String, codeHash: {type:String,select:false},
  attempts: {type:Number,default:0}, expiresAt: Date, requestedAt: Date,
  consumedAt: Date
});
schema.index({expiresAt:1},{expireAfterSeconds:0});
schema.index({accountId:1,role:1,purpose:1},{unique:true});
module.exports = mongoose.model('EmailChallenge', schema);
