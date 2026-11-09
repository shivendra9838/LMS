const mongoose=require('mongoose');
// Append-only analysis snapshots; never used to approve loans or post financial entries.
const schema=new mongoose.Schema({customerId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
  actorId:{type:mongoose.Schema.Types.ObjectId,required:true},actorRole:{type:String,enum:['ADMIN','EMPLOYEE'],required:true},
  version:String,policyHash:String,inputHash:String,asOf:String,assessment:mongoose.Schema.Types.Mixed},{timestamps:true});
schema.index({customerId:1,actorId:1,policyHash:1,inputHash:1,asOf:1},{unique:true});
module.exports=mongoose.model('CustomerRiskAssessment',schema);
