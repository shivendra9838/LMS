// Admin-only, read-only projection of existing legacy and KYC requests.
const Lead=require('../models/CustomerLead');
const {dayStart,addDays}=require('../utils/businessDay');
const states=['PENDING','CORRECTION_REQUIRED','APPROVED','REJECTED'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
async function list(query,user){
 if(user.role!=='ADMIN')fail(403,'Admin access is required for the customer request directory');
 const page=Number(query.page||1),limit=Number(query.limit||10),status=query.status||'PENDING';
 if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>200)fail(422,'Choose a valid page and page size');
 if(!states.includes(status))fail(422,'Choose a valid request status');
 if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>100))fail(422,'Search is limited to 100 characters');
 const match={status:{$in:states}};
 if(query.employeeId){if(!require('mongoose').isValidObjectId(query.employeeId))fail(422,'Choose a valid referring employee');match.submittedByEmployeeId=new (require('mongoose').Types.ObjectId)(query.employeeId);}
 const submitted={$max:{$map:{input:{$filter:{input:{$ifNull:['$history',[]]},as:'entry',cond:{$eq:['$$entry.action','SUBMITTED']}}},as:'entry',in:'$$entry.at'}}};
 const stages=[{$match:match},{$set:{requestDate:{$ifNull:[submitted,'$createdAt']}}}];
 if(query.startDate||query.endDate){if(query.startDate&&query.endDate&&query.startDate>query.endDate)fail(422,'Through date must be on or after the start date');const date={};if(query.startDate)date.$gte=dayStart(query.startDate);if(query.endDate)date.$lt=dayStart(addDays(query.endDate,1));stages.push({$match:{requestDate:date}});}
 stages.push({$lookup:{from:'employees',localField:'submittedByEmployeeId',foreignField:'_id',pipeline:[{$project:{name:1,employeeCode:1}}],as:'referrer'}},{$lookup:{from:'customers',localField:'customerId',foreignField:'_id',pipeline:[{$project:{name:1,customerCode:1}}],as:'customer'}});
 if(query.search?.trim()){const escaped=[...query.search.trim()].map(char=>'\\^$.*+?()[]{}|'.includes(char)?'\\'+char:char).join(''),regex=new RegExp(escaped,'i');stages.push({$match:{$or:['name','mobile','customer.customerCode','referrer.name','referrer.employeeCode'].map(field=>({[field]:regex}))}});}
 if(query.sort&&!['newest','oldest'].includes(query.sort))fail(422,'Choose a valid request sort');
 const [result]=await Lead.aggregate([...stages,{$facet:{counts:[{$group:{_id:'$status',count:{$sum:1}}}],total:[{$match:{status}},{$count:'value'}],rows:[{$match:{status}},{$sort:{requestDate:query.sort==='oldest'?1:-1,_id:query.sort==='oldest'?1:-1}},{$skip:(page-1)*limit},{$limit:limit},{$lookup:{from:'kycdocuments',let:{ids:{$cond:[{$eq:['$status','APPROVED']},{$ifNull:['$approvedDocumentIds',[]]},{$ifNull:['$documentIds',[]]}]},lead:'$_id'},pipeline:[{$match:{$expr:{$and:[{$in:['$_id','$$ids']},{$eq:['$leadId','$$lead']},{$eq:['$kind','PHOTO']}]}}},{$project:{_id:1}}],as:'photo'}},{$project:{name:1,mobile:1,status:1,kycVersion:1,version:'$__v',createdAt:1,requestDate:1,adminRemarks:1,approvedAt:1,customerId:1,customerCode:{$arrayElemAt:['$customer.customerCode',0]},submittedByEmployeeId:{$arrayElemAt:['$referrer',0]},photoDocumentId:{$arrayElemAt:['$photo._id',0]}}}]}}]);
 const counts=Object.fromEntries(states.map(state=>[state,0]));for(const item of result.counts)counts[item._id]=item.count;
 const total=result.total[0]?.value||0;return {leads:result.rows,counts,total,page,totalPages:Math.ceil(total/limit)};
}
module.exports={list};
