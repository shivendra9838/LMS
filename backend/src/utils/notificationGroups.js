const groups=require('../services/notificationTarget.service').groups;
const legacyText={$concat:['kind','title','path','eventKey'].flatMap((field,index)=>[...(index?[' ']:[]),{$ifNull:['$'+field,''] }])};
const category={$cond:[{$gt:[{$strLenCP:{$ifNull:['$category','']}},0]},'$category',{$switch:{branches:Object.entries(groups).map(([key,regex])=>({case:{$regexMatch:{input:legacyText,regex}},then:key})),default:'SYSTEM'}}]};
const expression={$switch:{branches:[{case:{$in:[category,['PAYMENTS','SETTLEMENTS']]},then:'PAYMENTS'},{case:{$in:[category,['LOANS','REMINDERS']]},then:'LOANS'}],default:'SYSTEM'}};
module.exports={expression};
