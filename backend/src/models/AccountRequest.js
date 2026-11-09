const mongoose=require('mongoose');
const schema=new mongoose.Schema({employeeId:{type:mongoose.Schema.Types.ObjectId,ref:'Employee',required:true},kind:{type:String,enum:['PROFILE_CHANGE','DEACTIVATION'],required:true},status:{type:String,enum:['PENDING','APPROVED','REJECTED','CANCELLED'],default:'PENDING'},reason:{type:String,required:true,maxlength:1000},changes:{type:Map,of:String},previous:{type:Map,of:String},reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin'},reviewedAt:Date,remarks:{type:String,maxlength:1000}},{timestamps:true});
schema.index({employeeId:1,kind:1},{unique:true,partialFilterExpression:{status:'PENDING'}});
schema.index({status:1,createdAt:-1});
module.exports=mongoose.model('AccountRequest',schema);
