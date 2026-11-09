const mongoose=require('mongoose');
module.exports=mongoose.model('NotificationDispatch',new mongoose.Schema({_id:String,startedAt:Date,completedAt:Date},{versionKey:false}));
