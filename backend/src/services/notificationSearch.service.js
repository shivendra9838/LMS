const mongoose=require('mongoose');
const Inbox=require('../models/UserNotification'),Collection=require('../models/Collection'),Audit=require('../models/AuditLog');
const convert=input=>({$convert:{input,to:'objectId',onError:null,onNull:null}});
// Search legacy receipt alerts through their original references. No snapshots
// are rewritten, and joins stay inside the authenticated recipient's inbox.
module.exports=async function search(where,text,page,limit,user){
 const literal=String(text).slice(0,150),escaped=literal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),rx={$regex:escaped,$options:'i'};
 const matches=['title','message','_payment.collectionNumber','_customer.name','_customer.customerCode','_employee.name','_employee.employeeCode','_loan.loanNumber'].map(field=>({[field]:rx}));
 if(/^₹?\s*\d[\d,]*(\.\d{1,2})?$/.test(literal))matches.push({'_payment.amountReceived':Number(literal.replace(/[₹,\s]/g,''))});
 const [result]=await Inbox.aggregate([
  {$match:{...where,recipientId:new mongoose.Types.ObjectId(user.id)}},
  {$set:{_auditId:convert({$substrBytes:[{$ifNull:['$eventKey','']},6,24]})}},
  {$lookup:{from:Audit.collection.name,localField:'_auditId',foreignField:'_id',as:'_audit'}},
  {$set:{_paymentRef:{$ifNull:['$paymentId',{$cond:[{$in:[{$arrayElemAt:['$_audit.action',0]},['PAYMENT_RECEIVED','CUSTOMER_PAYMENT_VERIFIED']]},convert({$arrayElemAt:['$_audit.referenceId',0]}),{$cond:[{$regexMatch:{input:{$ifNull:['$path','']},regex:/^\/(admin|employee)\/collections\/receipt\/[a-f\d]{24}$/i}},convert({$arrayElemAt:[{$split:['$path','/']},-1]}),null]}]}]}}},
  {$lookup:{from:Collection.collection.name,let:{ref:'$_paymentRef'},pipeline:[{$match:{$expr:{$eq:['$_id','$$ref']},amountReceived:{$gt:0},status:{$in:['PAID','PARTIAL','EXTRA_PAYMENT']},...(user.role==='EMPLOYEE'?{employeeId:new mongoose.Types.ObjectId(user.id)}:{})}},{$project:{collectionNumber:1,amountReceived:1,customerId:1,collectedBy:1,loanId:1}}],as:'_payment'}},
  {$lookup:{from:require('../models/Customer').collection.name,localField:'_payment.customerId',foreignField:'_id',pipeline:[{$project:{name:1,customerCode:1}}],as:'_customer'}},
  {$lookup:{from:require('../models/Employee').collection.name,localField:'_payment.collectedBy',foreignField:'_id',pipeline:[{$project:{name:1,employeeCode:1}}],as:'_employee'}},
  {$lookup:{from:require('../models/Loan').collection.name,localField:'_payment.loanId',foreignField:'_id',pipeline:[{$project:{loanNumber:1}}],as:'_loan'}},
  {$match:{$or:matches}},
  {$facet:{rows:[{$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*limit},{$limit:limit},{$unset:['_auditId','_audit','_paymentRef','_payment','_customer','_employee','_loan','recipientId','role']}],total:[{$count:'count'}]}}
 ]);
 return {rows:result.rows,total:result.total[0]?.count||0};
};
