const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 loanId:{type:mongoose.Schema.Types.ObjectId,ref:'Loan',required:true,index:true},
 customerId:{type:mongoose.Schema.Types.ObjectId,ref:'Customer',required:true},
 assignedEmployeeId:{type:mongoose.Schema.Types.ObjectId,ref:'Employee',required:true},
 authorId:{type:mongoose.Schema.Types.ObjectId,refPath:'authorModel',required:true},
 authorModel:{type:String,enum:['Admin','Employee'],required:true},
 authorRole:{type:String,enum:['ADMIN','EMPLOYEE'],required:true},
 reason:{type:String,enum:['CUSTOMER_UNAVAILABLE','INSUFFICIENT_FUNDS','BUSINESS_CLOSED','PROMISED_ANOTHER_DATE','CUSTOMER_REFUSED','OTHER']},originalDueDate:Date,
 status:{type:String,enum:['PROMISED_TO_PAY','NO_RESPONSE','WILL_PAY_LATER','PAYMENT_DISPUTE'],required:true},
 followUpDate:{type:Date,required:true},remarks:{type:String,required:true,maxlength:2000},
 promisedDate:Date,nextReminderDate:{type:Date,required:true},
 idempotencyKey:{type:String,required:true},requestHash:{type:String,required:true,select:false}
},{timestamps:true});
schema.index({authorId:1,idempotencyKey:1},{unique:true});
schema.index({loanId:1,followUpDate:-1,createdAt:-1,_id:-1});
module.exports=mongoose.model('OverdueFollowUp',schema);
