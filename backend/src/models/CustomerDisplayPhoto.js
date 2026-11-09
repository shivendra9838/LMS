const mongoose=require('mongoose');
// Append-only display assets, separate from Customer fields and approved KYC documents/snapshots.
const schema=new mongoose.Schema({customerId:{type:mongoose.Schema.Types.ObjectId,ref:'Customer',required:true,immutable:true},
 encryptedBytes:{type:Buffer,required:true,select:false,immutable:true},mime:{type:String,default:'image/webp',immutable:true},
 digest:{type:String,required:true,immutable:true},crop:{x:Number,y:Number,zoom:Number},
 actorId:{type:mongoose.Schema.Types.ObjectId,required:true,immutable:true},actorRole:{type:String,enum:['ADMIN','EMPLOYEE'],required:true,immutable:true}
},{timestamps:true});
schema.index({customerId:1,createdAt:-1,_id:-1});
module.exports=mongoose.model('CustomerDisplayPhoto',schema);
