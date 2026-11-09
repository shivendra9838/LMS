// Read-only listing projection. Never decrypt KYC payloads or return document bytes.
const Lead=require('../models/CustomerLead'),Customer=require('../models/Customer');
const {dayStart,addDays}=require('../utils/businessDay');
const statuses=['DRAFT','PENDING','APPROVED','REJECTED','CORRECTION_REQUIRED'];
const fail=message=>{throw Object.assign(new Error(message),{status:422});};
async function list(query,user){
 const page=Number(query.page||1),limit=Number(query.limit||10),status=query.status||'ALL';
 if(!statuses.includes(status)&&status!=='ALL')fail('Choose a valid KYC status');
 const match={kycVersion:1};
 if(user.role==='EMPLOYEE'){
  const assigned=await Customer.find({employeeId:user.id}).distinct('_id');
  match.$or=[{customerId:{$exists:false},submittedByEmployeeId:new (require('mongoose').Types.ObjectId)(user.id)},{customerId:{$in:assigned}}];
 }else match.status={$ne:'DRAFT'};
 if(query.search){const escaped=String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');match.$and=[{$or:[{name:new RegExp(escaped,'i')},{mobile:new RegExp(escaped,'i')}]}];}
 const eventDate=actions=>({$max:{$map:{input:{$filter:{input:{$ifNull:['$history',[]]},as:'h',cond:{$in:['$$h.action',actions]}}},as:'h',in:'$$h.at'}}});
 const stages=[{$match:match},{$set:{submittedOn:eventDate(['SUBMITTED']),reviewedOn:{$ifNull:[eventDate(['APPROVED','REJECTED','CORRECTION_REQUIRED']),'$approvedAt']}}}];
 if(query.startDate||query.endDate){if(query.startDate&&query.endDate&&query.startDate>query.endDate)fail('Start date must be on or before end date');const date={};if(query.startDate)date.$gte=dayStart(query.startDate);if(query.endDate)date.$lt=dayStart(addDays(query.endDate,1));stages.push({$match:{submittedOn:date}});}
 const [result]=await Lead.aggregate([...stages,{$facet:{counts:[{$group:{_id:'$status',count:{$sum:1}}}],total:[...(status==='ALL'?[]:[{$match:{status}}]),{$count:'value'}],rows:[...(status==='ALL'?[]:[{$match:{status}}]),{$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*limit},{$limit:limit},{$lookup:{from:'kycdocuments',let:{ids:'$documentIds',lead:'$_id'},pipeline:[{$match:{$expr:{$and:[{$in:['$_id',{$ifNull:['$$ids',[]]}]},{$eq:['$leadId','$$lead']},{$eq:['$kind','PHOTO']}]}}},{$project:{_id:1}}],as:'photo'}},{$lookup:{from:'customers',localField:'customerId',foreignField:'_id',pipeline:[{$project:{customerCode:1}}],as:'customer'}},{$project:{name:1,mobile:1,status:1,customerId:1,submittedOn:1,reviewedOn:1,customerCode:{$arrayElemAt:['$customer.customerCode',0]},photoDocumentId:{$arrayElemAt:['$photo._id',0]}}}]}}]);
 const counts=Object.fromEntries(statuses.map(s=>[s,0]));for(const item of result.counts)counts[item._id]=item.count;counts.ALL=Object.values(counts).reduce((a,b)=>a+b,0);const total=result.total[0]?.value||0;
 return {leads:result.rows,counts,total,page,totalPages:Math.ceil(total/limit)};
}
module.exports={list};

