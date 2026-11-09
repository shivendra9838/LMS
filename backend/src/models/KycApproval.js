const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 leadId:{type:mongoose.Schema.Types.ObjectId,ref:'CustomerLead',required:true,immutable:true},
 submissionId:{type:mongoose.Schema.Types.ObjectId,ref:'KycSubmission',required:true,immutable:true,unique:true},
 adminSignatureId:{type:mongoose.Schema.Types.ObjectId,ref:'KycVerificationSignature',required:true,immutable:true},
 assignedEmployeeId:{type:mongoose.Schema.Types.ObjectId,ref:'Employee',required:true,immutable:true},
 assignedEmployeeName:{type:String,required:true,immutable:true},assignedEmployeeCode:{type:String,immutable:true},
 signedPdfEncrypted:{type:Buffer,select:false,immutable:true},pdfDigest:{type:String,immutable:true},
 approvedAt:{type:Date,required:true,immutable:true}
},{timestamps:true});
module.exports=mongoose.model('KycApproval',schema);
