const mongoose=require('mongoose');
const schema=new mongoose.Schema({recipientId:{type:mongoose.Schema.Types.ObjectId,required:true},role:{type:String,enum:['ADMIN','EMPLOYEE'],required:true},eventKey:{type:String,required:true},title:{type:String,required:true},message:{type:String,required:true},path:{type:String,required:true},kind:String,category:String,customerId:mongoose.Schema.Types.ObjectId,employeeId:mongoose.Schema.Types.ObjectId,loanId:mongoose.Schema.Types.ObjectId,kycRequestId:mongoose.Schema.Types.ObjectId,settlementId:mongoose.Schema.Types.ObjectId,paymentId:{type:mongoose.Schema.Types.ObjectId,ref:'Collection'},readAt:Date,dismissedAt:Date},{timestamps:true});
schema.index({recipientId:1,role:1,eventKey:1},{unique:true});schema.index({recipientId:1,role:1,createdAt:-1});
schema.index({recipientId:1,role:1,readAt:1,createdAt:-1});
schema.index({recipientId:1,role:1,updatedAt:-1});
module.exports=mongoose.model('UserNotification',schema);
