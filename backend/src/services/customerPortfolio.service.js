const mongoose=require('mongoose');
const Customer=require('../models/Customer'),Employee=require('../models/Employee'),Loan=require('../models/Loan');
const finance=require('./settlement.service');
const {OPEN_STATUSES,overdueAggregation,scheduleSummary}=require('./overdue.service');
const {mongoMinor,major}=require('../utils/money');
const collation={locale:'en',strength:2};
const id=value=>{if(typeof value!=='string'||!/^[a-f\d]{24}$/i.test(value))throw finance.error(422,'Use a valid record identifier');return new mongoose.Types.ObjectId(value);};
const pageInfo=q=>{const page=Number(q.page||1),limit=Number(q.limit||20);if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>100)throw finance.error(422,'Use a positive page and a page size up to 100');return {page,limit,skip:(page-1)*limit};};
const prefix=(search,fields)=>{if(search===undefined||search==='')return {};if(typeof search!=='string'||search.length>100)throw finance.error(422,'Search is limited to 100 characters');const value=search.trim();return value?{$or:fields.map(field=>({[field]:{$gte:value,$lt:value+'\uffff'}}))}:{};};
const sortInfo=(q,allowed)=>{const field=q.sort||'name';if(!allowed.includes(field)||q.direction&&!['asc','desc'].includes(q.direction))throw finance.error(422,'Choose a supported sort field and direction');return {[field]:q.direction==='desc'?-1:1,_id:1};};
const meta=(total,p)=>({total,page:p.page,limit:p.limit,totalPages:Math.ceil(total/p.limit)});
const amountFields=row=>{const out={...row};for(const [source,target]of [['outstandingMinor','totalOutstanding'],['overdueMinor','overdueAmount']]){out[target]=major(out[source]||0);delete out[source];}return out;};
const safeProfile={name:1,customerCode:1,occupation:1,mobile:1,city:1,area:1,status:1,employeeId:1,branchId:1,kycLeadId:1,kycApprovedAt:1,createdAt:1};

// All balances come from recorded Loan fields; overdue uses the shared source-of-truth schedule rule.
function financialLookup(){return {$lookup:{from:'loans',let:{customerId:'$_id'},pipeline:[
 {$match:{$expr:{$eq:['$customerId','$$customerId']}}},
 {$lookup:{from:'loanschedules',let:{loanId:'$_id'},pipeline:overdueAggregation(),as:'pastDue'}},
 {$set:{pastDue:{$ifNull:[{$arrayElemAt:['$pastDue',0]},{amountMinor:0,installments:0}]},open:{$and:[{$in:['$status',OPEN_STATUSES]},{$gt:['$remainingAmount',0]}]}}},
 {$group:{_id:null,loanCount:{$sum:1},activeLoanCount:{$sum:{$cond:['$open',1,0]}},outstandingMinor:{$sum:mongoMinor('$remainingAmount')},overdueMinor:{$sum:{$cond:['$open','$pastDue.amountMinor',0]}},overdueInstallments:{$sum:{$cond:['$open','$pastDue.installments',0]}}}}
],as:'financial'}};}
const financialFields=()=>[financialLookup(),{$set:{financial:{$ifNull:[{$arrayElemAt:['$financial',0]},{loanCount:0,activeLoanCount:0,outstandingMinor:0,overdueMinor:0,overdueInstallments:0}]}}}];
function employeeStats(){return [{$lookup:{from:'customers',let:{employeeId:'$_id'},pipeline:[{$match:{$expr:{$eq:['$employeeId','$$employeeId']}}},...financialFields(),{$group:{_id:null,customerCount:{$sum:1},activeLoanCustomers:{$sum:{$cond:[{$gt:['$financial.activeLoanCount',0]},1,0]}},activeLoanCount:{$sum:'$financial.activeLoanCount'},overdueCustomers:{$sum:{$cond:[{$gt:['$financial.overdueMinor',0]},1,0]}},outstandingMinor:{$sum:'$financial.outstandingMinor'}}}],as:'stats'}},{$set:{stats:{$ifNull:[{$arrayElemAt:['$stats',0]},{customerCount:0,activeLoanCustomers:0,activeLoanCount:0,overdueCustomers:0,outstandingMinor:0}]}}},{$set:{customerCount:'$stats.customerCount',activeLoanCustomers:'$stats.activeLoanCustomers',activeLoanCount:'$stats.activeLoanCount',overdueCustomers:'$stats.overdueCustomers',outstandingMinor:'$stats.outstandingMinor'}}];}

async function summary(){
 const [employees,activeEmployees,inactiveEmployees,customers,loanCustomers,outstanding]=await Promise.all([
  Employee.countDocuments(),Employee.countDocuments({status:'ACTIVE'}),Employee.countDocuments({status:'INACTIVE'}),
  Customer.aggregate([{$group:{_id:'$employeeId',total:{$sum:1},active:{$sum:{$cond:[{$eq:['$status','ACTIVE']},1,0]}}}},{$lookup:{from:'employees',localField:'_id',foreignField:'_id',pipeline:[{$project:{_id:1}}],as:'owner'}},{$group:{_id:null,totalCustomers:{$sum:'$total'},activeCustomers:{$sum:'$active'},assignedCustomers:{$sum:{$cond:[{$gt:[{$size:'$owner'},0]},'$total',0]}}}}]),
  Loan.aggregate([{$match:{status:{$in:OPEN_STATUSES},remainingAmount:{$gt:0}}},{$group:{_id:'$customerId'}},{$lookup:{from:'customers',localField:'_id',foreignField:'_id',pipeline:[{$project:{_id:1}}],as:'customer'}},{$match:{'customer.0':{$exists:true}}},{$count:'total'}]),
  Loan.aggregate([{$lookup:{from:'customers',localField:'customerId',foreignField:'_id',pipeline:[{$project:{_id:1}}],as:'customer'}},{$match:{'customer.0':{$exists:true}}},{$group:{_id:null,outstandingMinor:{$sum:mongoMinor('$remainingAmount')}}}])
 ]);
 const row=customers[0]||{totalCustomers:0,activeCustomers:0,assignedCustomers:0};delete row._id;return {totalEmployees:employees,activeEmployees,inactiveEmployees,totalOutstanding:major(outstanding[0]?.outstandingMinor||0),...row,unassignedCustomers:row.totalCustomers-row.assignedCustomers,customersWithActiveLoans:loanCustomers[0]?.total||0};
}
async function directory(query,user){
 await finance.authorize(user,true);const p=pageInfo(query),sort=sortInfo(query,['name','customerCount','outstandingMinor']);
 const match=prefix(query.search,['name','employeeCode','phone']);if(query.status){if(!['ACTIVE','INACTIVE'].includes(query.status))throw finance.error(422,'Choose active or inactive employees');match.status=query.status;}if(query.branchId)match.branchId=id(query.branchId);
 const rowsPipeline=Object.hasOwn(sort,'name')?[{$sort:sort},{$skip:p.skip},{$limit:p.limit},...employeeStats()]:[...employeeStats(),{$sort:sort},{$skip:p.skip},{$limit:p.limit}];
 const [aggregation,totals,branches]=await Promise.all([
  Employee.aggregate([{$match:match},{$facet:{total:[{$count:'count'}],rows:[...rowsPipeline,{$lookup:{from:'branches',localField:'branchId',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'branch'}},{$project:{name:1,employeeCode:1,city:1,area:1,status:1,branchId:1,branchName:{$arrayElemAt:['$branch.name',0]},customerCount:1,activeLoanCustomers:1,activeLoanCount:1,overdueCustomers:1,outstandingMinor:1}}]}}]).collation(collation),
  summary(),require('../models/Branch').find().select('name status').sort({name:1}).limit(200).lean()
 ]);
 const photos=await require('../models/AccountSettings').find({userId:{$in:aggregation[0].rows.map(row=>row._id)},role:'EMPLOYEE',photoType:{$exists:true}}).select('userId photoUpdatedAt').lean();
 const photoById=new Map(photos.map(photo=>[String(photo.userId),photo.photoUpdatedAt?.toISOString()||true]));
 return {rows:aggregation[0].rows.map(row=>({...amountFields(row),hasPhoto:photoById.get(String(row._id))||false})),meta:meta(aggregation[0].total[0]?.count||0,p),summary:totals,branches};
}
async function employeeOptions(query,user){await finance.authorize(user,true);const p=pageInfo(query);const match={status:'ACTIVE',...prefix(query.search,['name','employeeCode','phone'])};const [rows,total]=await Promise.all([Employee.find(match).select('name employeeCode city').collation(collation).sort({name:1,_id:1}).skip(p.skip).limit(p.limit).lean(),Employee.countDocuments(match).collation(collation)]);return {rows,meta:meta(total,p)};}
async function employeeProfile(employeeId){const employee=await Employee.findById(id(employeeId)).select('name employeeCode city area branchId status').populate('branchId','name').lean();if(!employee)throw finance.error(404,'Employee not found');return employee;}
function financialSummary(){return [...financialFields(),{$set:{loanCount:'$financial.loanCount',activeLoanCount:'$financial.activeLoanCount',outstandingMinor:'$financial.outstandingMinor',overdueMinor:'$financial.overdueMinor',overdueInstallments:'$financial.overdueInstallments'}}];}
function lastPayment(){return [{$lookup:{from:'collections',let:{customerId:'$_id'},pipeline:[{$match:{$expr:{$eq:['$customerId','$$customerId']},amountReceived:{$gt:0}}},{$sort:{paymentDate:-1,_id:-1}},{$limit:1},{$project:{paymentDate:1}}],as:'lastReceipt'}},{$set:{lastPaymentDate:{$arrayElemAt:['$lastReceipt.paymentDate',0]}}}];}
function kycEnrichment(){return [{$lookup:{from:'customerleads',localField:'kycLeadId',foreignField:'_id',pipeline:[{$project:{status:1,approvedAt:1}}],as:'kyc'}},{$set:{kycReviewStatus:{$arrayElemAt:['$kyc.status',0]},kycStatus:{$cond:[{$or:[{$ne:[{$ifNull:['$kycApprovedAt',null]},null]},{$ne:[{$ifNull:[{$arrayElemAt:['$kyc.approvedAt',0]},null]},null]},{$eq:[{$arrayElemAt:['$kyc.status',0]},'APPROVED']}]},'APPROVED',{$ifNull:[{$arrayElemAt:['$kyc.status',0]},'NOT_RECORDED']}]}}}];}
function customerEnrichment(){return [...financialSummary(),...lastPayment(),...kycEnrichment()];}
async function customers(query,user,employeeId){
 await finance.authorize(user,true);const p=pageInfo(query);const sort=sortInfo(query,['name','customerCode','outstandingMinor','overdueMinor','lastPaymentDate']);
 const match=prefix(query.search,['name','customerCode','mobile']);const employee=employeeId?await employeeProfile(employeeId):null;if(employee)match.employeeId=employee._id;
 if(query.status){if(!['ACTIVE','INACTIVE'].includes(query.status))throw finance.error(422,'Choose a customer status');match.status=query.status;}
 for(const field of ['city','area'])if(query[field]){if(typeof query[field]!=='string'||query[field].length>100)throw finance.error(422,'Location filter is too long');match[field]=query[field];}
 if(query.assignment&&!['all','unassigned'].includes(query.assignment))throw finance.error(422,'Choose all or unassigned customers');
 if(query.kycStatus&&!['APPROVED','PENDING','REJECTED','CORRECTION_REQUIRED','DRAFT','NOT_RECORDED'].includes(query.kycStatus))throw finance.error(422,'Choose a KYC status');
 if(query.loanState&&!['active','overdue','none'].includes(query.loanState))throw finance.error(422,'Choose a supported loan filter');
 const financialSort=!Object.hasOwn(sort,'name')&&!Object.hasOwn(sort,'customerCode');
 // Let indexed name/code order run before enrichment. Owner and financial lookups normally run only for the requested page.
 const ownerLookup={$lookup:{from:'employees',localField:'employeeId',foreignField:'_id',pipeline:[{$project:{name:1,employeeCode:1}}],as:'owner'}};
 const base=[{$match:match},...(!financialSort?[{$sort:sort}]:[]),{$project:safeProfile}];if(query.assignment==='unassigned')base.push(ownerLookup,{$match:{'owner.0':{$exists:false}}});
 const financialEarly=Boolean(query.loanState)||Object.hasOwn(sort,'outstandingMinor')||Object.hasOwn(sort,'overdueMinor');
 const paymentEarly=Object.hasOwn(sort,'lastPaymentDate'),kycEarly=Boolean(query.kycStatus);
 if(financialEarly)base.push(...financialSummary());
 if(paymentEarly)base.push(...lastPayment());
 if(kycEarly)base.push(...kycEnrichment(),{$match:{kycStatus:query.kycStatus}});
 if(query.loanState)base.push({$match:query.loanState==='active'?{activeLoanCount:{$gt:0}}:query.loanState==='overdue'?{overdueMinor:{$gt:0}}:{loanCount:0}});
 const rows=[...(financialSort?[{$sort:sort}]:[]),{$skip:p.skip},{$limit:p.limit},...(query.assignment!=='unassigned'?[ownerLookup]:[]),...(!financialEarly?financialSummary():[]),...(!paymentEarly?lastPayment():[]),...(!kycEarly?kycEnrichment():[]),{$project:{...safeProfile,assignedEmployeeId:'$employeeId',employee:{$arrayElemAt:['$owner',0]},loanCount:1,activeLoanCount:1,outstandingMinor:1,overdueMinor:1,overdueInstallments:1,lastPaymentDate:1,kycStatus:1,kycReviewStatus:1}}];
 const [result]=await Customer.aggregate([...base,{$facet:{total:[{$count:'count'}],rows}}]).collation(collation);
 return {rows:result.rows.map(amountFields),meta:meta(result.total[0]?.count||0,p),employee};
}
async function requireCustomer(customerId){const customer=await Customer.findById(id(customerId)).lean();if(!customer)throw finance.error(404,'Customer not found');return customer;}
async function detail(customerId,user){
 await finance.authorize(user,true);const customer=await requireCustomer(customerId);
 const [enriched]=await Customer.aggregate([{$match:{_id:customer._id}},{$project:safeProfile},...customerEnrichment()]);
 const [employee,receipts,openLoans,closedLoanCount]=await Promise.all([
  customer.employeeId?Employee.findById(customer.employeeId).select('name employeeCode city status').lean():null,
  require('../models/Collection').find({customerId:customer._id,amountReceived:{$gt:0}}).select('amountReceived paymentDate status').lean(),
  Loan.find({customerId:customer._id,status:{$in:OPEN_STATUSES},remainingAmount:{$gt:0}}).select('_id loanNumber').lean(),
  Loan.countDocuments({customerId:customer._id,status:{$in:['COMPLETED','CLOSED']}})
 ]);
 const validReceipts=receipts.filter(require('./collectionPerformance.service').validReceipt);
 const receiptMinor=validReceipts.reduce((sum,receipt)=>sum+require('../utils/money').legacyMinor(receipt.amountReceived),0);
 const next=await require('../models/LoanSchedule').findOne({loanId:{$in:openLoans.map(loan=>loan._id)},$expr:require('../utils/installmentSequence').unpaidExpression()}).select('loanId dayNumber date amount paidAmount').sort({date:1,dayNumber:1,_id:1}).lean();
 const {financial,lastReceipt,kyc,...safe}=enriched;
 return {...amountFields(safe),closedLoanCount,employee,assignedEmployeeId:customer.employeeId||null,totalCollected:major(receiptMinor),recordedReceiptCount:validReceipts.length,nextInstallment:next?{...require('../utils/installmentStatus').present(next),loanNumber:openLoans.find(loan=>String(loan._id)===String(next.loanId))?.loanNumber}:null};
}
async function loans(customerId,query,user){await finance.authorize(user,true);await requireCustomer(customerId);const p=pageInfo(query);const [rows,total]=await Promise.all([Loan.find({customerId}).populate('employeeId','name employeeCode').sort({createdAt:-1,_id:-1}).skip(p.skip).limit(p.limit).lean(),Loan.countDocuments({customerId})]);const schedules=await require('../models/LoanSchedule').find({loanId:{$in:rows.map(r=>r._id)}}).select('loanId date amount paidAmount paidDate status').lean();const byLoan=new Map();for(const s of schedules){const key=String(s.loanId);if(!byLoan.has(key))byLoan.set(key,[]);byLoan.get(key).push(s);}return {rows:rows.map(loan=>({...loan,...scheduleSummary(loan,byLoan.get(String(loan._id))||[])})),meta:meta(total,p)};}
async function payments(customerId,query,user){await finance.authorize(user,true);await requireCustomer(customerId);const p=pageInfo(query),Collection=require('../models/Collection');const [rows,total]=await Promise.all([Collection.find({customerId}).select('collectionNumber loanId loanScheduleId employeeId amountReceived paymentMode status paymentDate createdAt allocations backdateReason recordedByRole').populate('loanId','loanNumber').populate('employeeId','name employeeCode').populate('loanScheduleId','date dayNumber').sort({paymentDate:-1,_id:-1}).skip(p.skip).limit(p.limit).lean(),Collection.countDocuments({customerId})]);return {rows:rows.map(row=>({...row,allocations:(row.allocations||[]).map(a=>({...a,timing:require('../utils/installmentStatus').timing(row.paymentDate,a.dueDate)}))})),meta:meta(total,p)};}
async function history(customerId,query,user){await finance.authorize(user,true);const customer=await requireCustomer(customerId),p=pageInfo(query);const refs=[String(customer._id),...(customer.kycLeadId?[String(customer.kycLeadId)]:[])];const [result]=await require('../models/CustomerTimeline').aggregate([{$match:{customerId:customer._id}},{$project:{action:1,details:1,createdAt:1,kind:{$literal:'TIMELINE'}}},{$unionWith:{coll:'auditlogs',pipeline:[{$match:{referenceId:{$in:refs}}},{$project:{action:1,module:1,userRole:1,createdAt:1,kind:{$literal:'AUDIT'},details:{$cond:[{$eq:['$action','CUSTOMER_REASSIGNED']},'$newValue.reason','']}}}]}},{$sort:{createdAt:-1,_id:-1}},{$facet:{total:[{$count:'count'}],rows:[{$skip:p.skip},{$limit:p.limit}]}}]);return {rows:result.rows,meta:meta(result.total[0]?.count||0,p)};}
async function reassign(customerId,body,user){
 await finance.authorize(user,true);const target=id(body.employeeId);if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000)throw finance.error(422,'Give a reassignment reason of 5–1000 characters');if(body.previousEmployeeId!==null)id(body.previousEmployeeId);
 return finance.transaction(async session=>{
  const customer=await Customer.findById(id(customerId)).session(session);if(!customer)throw finance.error(404,'Customer not found');
  const previous=customer.employeeId?String(customer.employeeId):null;if(previous!==body.previousEmployeeId)throw finance.error(409,'Assignment changed. Reload the customer before reassigning');if(previous===String(target))throw finance.error(409,'Customer is already assigned to this employee');
  const employee=await Employee.findOne({_id:target,status:'ACTIVE'}).session(session);if(!employee)throw finance.error(422,'Choose an existing active employee');
  const effectiveAt=new Date();const updated=await Customer.findOneAndUpdate({_id:customer._id,employeeId:customer.employeeId||null},{$set:{employeeId:employee._id,branchId:employee.branchId||null},$inc:{__v:1}},{session,returnDocument:'after'});if(!updated)throw finance.error(409,'Assignment changed; retry after reloading');
  if(customer.kycLeadId)await require('../models/CustomerLead').updateOne({_id:customer.kycLeadId},{$set:{assignedEmployeeId:employee._id},$inc:{__v:1}},{session});
  await require('../models/AuditLog').create([{userId:user.id,userModel:'Admin',userRole:'ADMIN',module:'CUSTOMER',action:'CUSTOMER_REASSIGNED',referenceId:String(customer._id),oldValue:{employeeId:previous,branchId:customer.branchId},newValue:{employeeId:employee._id,branchId:employee.branchId,effectiveAt,reason:body.reason.trim(),policy:'Customer profile assignment only. Historical and current loan servicing, collection attribution and custody remain unchanged.'}}],{session});
  await require('../models/CustomerTimeline').create([{customerId:customer._id,action:'Customer Reassigned',details:`Customer profile assigned to ${employee.name} (${employee.employeeCode}). Reason: ${body.reason.trim()}. Loan servicing and historical financial records unchanged.`}],{session});
  return {customerId:customer._id,previousEmployeeId:previous,employeeId:employee._id,effectiveAt};
 });
}
module.exports={directory,employeeOptions,customers,detail,loans,payments,history,reassign,pageInfo,requireCustomer};
