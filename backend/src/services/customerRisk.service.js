const mongoose=require('mongoose');
const Customer=require('../models/Customer'),Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Collection=require('../models/Collection');
const finance=require('./settlement.service');
const {calculateRisk}=require('./customerRiskCalculator');
const identifier=value=>{if(typeof value!=='string'||!/^[a-f\d]{24}$/i.test(value))throw finance.error(422,'Use a valid customer or employee identifier');return new mongoose.Types.ObjectId(value);};
const scope=user=>user.role==='EMPLOYEE'?{employeeId:identifier(user.id)}:{};
async function assess(customers,now=new Date()){
 const ids=customers.map(c=>c._id);
 const loans=await Loan.find({customerId:{$in:ids},status:{$ne:'CANCELLED'}}).select('_id customerId status remainingAmount').lean();
 const loanIds=loans.map(l=>l._id);
 const [schedules,receipts]=await Promise.all([
  Schedule.find({loanId:{$in:loanIds}}).select('_id loanId dayNumber date amount paidAmount paidDate').lean(),
  // Read all receipt states so a voided/corrected allocation cannot fall back to
  // a legacy paidDate and accidentally provide positive repayment evidence.
  Collection.find({loanId:{$in:loanIds}}).select('loanId loanScheduleId paymentDate status amountReceived allocations').lean()
 ]);
 const grouped=new Map(ids.map(id=>[String(id),{loans:[],schedules:[],receipts:[]}]));
 const loanMap=new Map(loans.map(l=>[String(l._id),String(l.customerId)]));
 loans.forEach(l=>grouped.get(String(l.customerId)).loans.push(l));
 schedules.forEach(s=>grouped.get(loanMap.get(String(s.loanId))).schedules.push(s));
 receipts.forEach(r=>grouped.get(loanMap.get(String(r.loanId))).receipts.push(r));
 return customers.map(c=>{const g=grouped.get(String(c._id)),valid=g.receipts.filter(require('./collectionPerformance.service').validReceipt);return {customerId:c._id,name:c.name,customerCode:c.customerCode,mobile:c.mobile,status:c.status,loanCount:g.loans.length,totalOutstanding:g.loans.reduce((sum,l)=>sum+Math.max(0,Number(l.remainingAmount)||0),0),lastPayment:valid.length?new Date(Math.max(...valid.map(r=>new Date(r.paymentDate).getTime()))):null,...calculateRisk(g.loans,g.schedules,g.receipts,now)};});
}
const summary=row=>{const {evidence,...safe}=row;return safe;};
async function detail(id,user){
 await finance.authorize(user);const customer=await Customer.findOne({_id:identifier(id),...scope(user)}).select('_id name customerCode').lean();
 if(!customer)throw finance.error(404,'Customer not found in your authorized portfolio');
 const [assessment]=await assess([customer]);
 const Audit=require('../models/CustomerRiskAssessment');
 const auditKey={customerId:customer._id,actorId:identifier(user.id),policyHash:assessment.policyHash,inputHash:assessment.inputHash,asOf:assessment.asOf};
 try{await Audit.updateOne(auditKey,{$setOnInsert:{...auditKey,actorRole:user.role,version:assessment.version,assessment,createdAt:new Date(),updatedAt:new Date()}},{upsert:true,timestamps:false});}catch(error){if(error.code!==11000)throw error;}
 return summary(assessment);
}
async function batch(ids,user){
 await finance.authorize(user);if(typeof ids!=='string'||!ids||ids.split(',').length>100)throw finance.error(422,'Request between 1 and 100 customer identifiers');
 const customers=await Customer.find({_id:{$in:ids.split(',').map(identifier)},...scope(user)}).select('_id name customerCode').lean();
 return (await assess(customers)).map(summary);
}
async function list(query,user){
 await finance.authorize(user);const {page,limit,skip}=require('./customerPortfolio.service').pageInfo(query);
 const categories=['GOOD','REVIEW_REQUIRED','HIGH_RISK','INSUFFICIENT_HISTORY'];
 if(query.category&&!categories.includes(query.category))throw finance.error(422,'Choose a valid risk category');
 const match=scope(user);
 if(query.employeeId){if(user.role!=='ADMIN')throw finance.error(403,'Only Admin may filter another employee');match.employeeId=identifier(query.employeeId);}
 if(query.status){if(!['ACTIVE','INACTIVE'].includes(query.status))throw finance.error(422,'Choose a valid customer status');match.status=query.status;}
 if(query.search){if(typeof query.search!=='string'||query.search.length>100)throw finance.error(422,'Search is limited to 100 characters');const escaped=query.search.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');match.$or=[{name:new RegExp(escaped,'i')},{customerCode:new RegExp(escaped,'i')},{mobile:new RegExp(escaped,'i')}];}
 let rows=[],total=0;const counts=Object.fromEntries(categories.map(c=>[c,0]));let customerTotal=0;
 {
  // Category filters must use the current allocation records, not stale cached scores.
  // Keyset batches cap memory and use four queries per 100 customers, never per-customer queries.
  let after;const now=new Date();
  for(;;){const customers=await Customer.find({...match,...(after?{_id:{$gt:after}}:{})}).select('_id name customerCode mobile status').sort({_id:1}).limit(100).lean();if(!customers.length)break;
   for(const row of await assess(customers,now)){counts[row.category]++;customerTotal++;if(!query.category||row.category===query.category){if(total>=skip&&rows.length<limit)rows.push(row);total++;}}
   after=customers.at(-1)._id;
  }
 }
 return {rows:rows.map(summary),summary:{total:customerTotal,counts},meta:{page,limit,total,totalPages:Math.ceil(total/limit)}};
}
module.exports={detail,batch,list,assess};
