const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,required:true},role:{type:String,enum:['ADMIN','EMPLOYEE'],required:true},
 preferences:{appearance:{type:String,enum:['light','dark','system'],default:'light'},textSize:{type:String,enum:['normal','large'],default:'normal'},dateFormat:{type:String,enum:['DD/MM/YYYY','YYYY-MM-DD'],default:'DD/MM/YYYY'},notifications:{type:Boolean,default:true},language:{type:String,enum:['en'],default:'en'}},
 emailPreferences:{daily:{type:Boolean,default:true},overdue:{type:Boolean,default:true},kycLoan:{type:Boolean,default:true},paymentSettlement:{type:Boolean,default:true}},
 emailVerifiedHash:{type:String,select:false},emailVerifiedAt:Date,
 photo:{type:Buffer,select:false},photoType:String,photoUpdatedAt:Date
},{timestamps:true});
schema.index({userId:1,role:1},{unique:true});
module.exports=mongoose.model('AccountSettings',schema);
