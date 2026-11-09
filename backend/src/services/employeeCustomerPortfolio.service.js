const mongoose=require('mongoose');
const Customer=require('../models/Customer'),Loan=require('../models/Loan');
const finance=require('./settlement.service'),risk=require('./customerRisk.service');
const {OPEN_STATUSES}=require('./overdue.service');
const {mongoMinor,major}=require('../utils/money');
const fields='_id name customerCode mobile occupation city area status kycLeadId kycApprovedAt createdAt';
const categories=['GOOD','REVIEW_REQUIRED','HIGH_RISK','INSUFFICIENT_HISTORY'];
const review=category=>categories.includes(category)&&category!=='GOOD';
const counts=()=>({ALL:0,ACTIVE:0,AT_RISK:0,INACTIVE:0});
function count(out,row){out.ALL++;if(row.status==='ACTIVE')out.ACTIVE++;if(row.status==='INACTIVE')out.INACTIVE++;if(review(row.risk.category))out.AT_RISK++;}
function validate(query,user){
 const p=require('./customerPortfolio.service').pageInfo(query);
 if(query.employeeId&&query.employeeId!==user.id||query.employee&&query.employee!==user.id)throw finance.error(403,'You can only view your assigned customers');
 const filter=query.filter||'ALL',sort=query.sort||'RECENT';
 if(!['ALL','ACTIVE','AT_RISK','INACTIVE'].includes(filter))throw finance.error(422,'Choose a supported customer filter');
 if(!['RECENT','NAME_ASC','NAME_DESC','CODE','OVERDUE'].includes(sort))throw finance.error(422,'Choose a supported customer sort');
 if(query.category&&!categories.includes(query.category))throw finance.error(422,'Choose a supported repayment category');
 for(const field of ['search','city','area'])if(query[field]!==undefined&&(typeof query[field]!=='string'||query[field].length>100))throw finance.error(422,'Search and location filters are limited to 100 characters');
 return {...p,filter,sort};
}
async function project(query,user){
 await finance.authorize(user);if(user.role!=='EMPLOYEE')throw finance.error(403,'This portfolio is available to employees only');
 const options=validate(query,user),summary=counts(),filteredCounts=counts(),matches=[],now=new Date();
 const lower=v=>String(v||'').toLocaleLowerCase(),term=lower(query.search).trim(),city=lower(query.city).trim(),area=lower(query.area).trim();let after;
 // Risk requires real allocation history. Reuse the authoritative calculator in
 // bounded keyset batches; no risk snapshots or financial records are written.
 for(;;){
  const customers=await Customer.find({employeeId:user.id,...(after?{_id:{$gt:after}}:{})}).select(fields).sort({_id:1}).limit(100).lean();if(!customers.length)break;
  const assessments=new Map((await risk.assess(customers,now)).map(a=>[String(a.customerId),a]));
  for(const customer of customers){
   const a=assessments.get(String(customer._id)),row={...customer,risk:{category:a.category,score:a.score,ratingStatus:a.ratingStatus},overdueAmount:a.metrics.overdueAmount,overdueInstallments:a.metrics.overdueInstallments};count(summary,row);
   if(term&&![row.name,row.customerCode,row.mobile,row.city,row.area].some(v=>lower(v).includes(term))||city&&!lower(row.city).includes(city)||area&&!lower(row.area).includes(area))continue;
   if(query.category&&row.risk.category!==query.category)continue;count(filteredCounts,row);
   if(options.filter==='ACTIVE'&&row.status!=='ACTIVE'||options.filter==='INACTIVE'&&row.status!=='INACTIVE'||options.filter==='AT_RISK'&&!review(row.risk.category))continue;
   matches.push(row);
  }
  after=customers.at(-1)._id;
 }
 const text=(a,b)=>String(a||'').localeCompare(String(b||''),'en',{sensitivity:'base',numeric:true});
 matches.sort((a,b)=>{
  const tie=String(a._id).localeCompare(String(b._id));
  if(options.sort==='NAME_ASC')return text(a.name,b.name)||tie;
  if(options.sort==='NAME_DESC')return text(b.name,a.name)||tie;
  if(options.sort==='CODE')return text(a.customerCode,b.customerCode)||tie;
  if(options.sort==='OVERDUE')return b.overdueAmount-a.overdueAmount||text(a.name,b.name)||tie;
  return new Date(b.createdAt)-new Date(a.createdAt)||-tie;
 });
 return {options,summary,counts:filteredCounts,matches};
}
async function enrich(rows,user){
 const data=await Loan.aggregate([{$match:{customerId:{$in:rows.map(r=>r._id)},employeeId:new mongoose.Types.ObjectId(user.id),status:{$ne:'CANCELLED'}}},{$group:{_id:'$customerId',loanCount:{$sum:1},activeLoanCount:{$sum:{$cond:[{$and:[{$in:['$status',OPEN_STATUSES]},{$gt:['$remainingAmount',0]}]},1,0]}},outstandingMinor:{$sum:mongoMinor('$remainingAmount')}}}]);
 const byCustomer=new Map(data.map(row=>[String(row._id),row]));return rows.map(row=>{const totals=byCustomer.get(String(row._id));return {...row,loanCount:totals?.loanCount||0,activeLoanCount:totals?.activeLoanCount||0,outstandingAmount:major(totals?.outstandingMinor||0)};});
}
async function list(query,user){const data=await project(query,user),{page,limit,skip}=data.options;return {rows:await enrich(data.matches.slice(skip,skip+limit),user),summary:data.summary,counts:data.counts,meta:{page,limit,total:data.matches.length,totalPages:Math.ceil(data.matches.length/limit)}};}
// Excel-safe text cells: quoted CSV alone does not stop spreadsheet formulas.
function cell(value){const text=String(value??'');return '"'+(/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';}
async function exportCsv(query,user){
 const data=await project(query,user),lines=[['Customer Code','Name','Mobile','City','Area','Occupation','Account Status','Repayment Category','Active Assigned Loans','Assigned Loan Count','Assigned Loan Outstanding (INR)'].map(cell).join(',')];
 for(let i=0;i<data.matches.length;i+=100){for(const row of await enrich(data.matches.slice(i,i+100),user))lines.push([row.customerCode,row.name,row.mobile,row.city,row.area,row.occupation,row.status,row.risk.category,row.activeLoanCount,row.loanCount,row.outstandingAmount].map(cell).join(','));}
 return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
module.exports={list,exportCsv,cell};
