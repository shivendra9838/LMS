const mongoose=require('mongoose');
// Append-only snapshots. Application code never updates or deletes a submission.
const schema=new mongoose.Schema({leadId:{type:mongoose.Schema.Types.ObjectId,ref:'CustomerLead',required:true,immutable:true},leadVersion:{type:Number,required:true,immutable:true},encryptedData:{type:Buffer,required:true,select:false,immutable:true},documentIds:{type:[{type:mongoose.Schema.Types.ObjectId,ref:'KycDocument'}],immutable:true},employeeVerificationId:{type:mongoose.Schema.Types.ObjectId,ref:'KycVerificationSignature',immutable:true},submittedAt:{type:Date,immutable:true},source:{type:String,enum:['SUBMITTED','LEGACY_PENDING','LEGACY_APPROVED'],required:true,immutable:true}},{timestamps:true});
schema.index({leadId:1,leadVersion:1},{unique:true});
module.exports=mongoose.model('KycSubmission',schema);
