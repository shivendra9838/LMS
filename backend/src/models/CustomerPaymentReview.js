const mongoose = require('mongoose');
// Separate from financial custody and settlement verification. One review per real receipt.
const schema = new mongoose.Schema({
 collectionId: {type: mongoose.Schema.Types.ObjectId, ref:'Collection', required:true, unique:true},
 verifiedBy: {type: mongoose.Schema.Types.ObjectId, ref:'Admin', required:true},
 verifiedAt: {type:Date, required:true},
 remarks: {type:String, maxlength:1000, default:''},
 status: {type:String, enum:['VERIFIED'], default:'VERIFIED', required:true}
}, {timestamps:true});
module.exports = mongoose.model('CustomerPaymentReview', schema);
