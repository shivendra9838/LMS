const mongoose=require('mongoose');
// Append-only, private signature evidence. Never exposed by public storage routes.
const schema=new mongoose.Schema({
 leadId:{type:mongoose.Schema.Types.ObjectId,ref:'CustomerLead',required:true,immutable:true,index:true},
 leadVersion:{type:Number,required:true,immutable:true},binding:{type:String,required:true,immutable:true},
 actorId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},role:{type:String,enum:['ADMIN','EMPLOYEE'],required:true,immutable:true},
 name:{type:String,required:true,immutable:true},employeeCode:{type:String,immutable:true},
 mime:{type:String,required:true,immutable:true},digest:{type:String,required:true,immutable:true},
 encryptedBytes:{type:Buffer,required:true,immutable:true,select:false},signedAt:{type:Date,default:Date.now,immutable:true}
},{timestamps:true});
module.exports=mongoose.model('KycVerificationSignature',schema);
