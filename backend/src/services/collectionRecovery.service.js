const {businessDay}=require('../utils/businessDay'),{legacyMinor,major}=require('../utils/money');
async function read(user,query={}){
 if(query.view==='LOANS')return loanView(user,query);
 const totals=await require('./collectionPerformance.service').report(user,{limit:1,employeeId:query.employeeId});
 const rows=await require('./collection.service').getInstallmentsService(user,{scope:'ALL',employeeId:query.employeeId});
 const today=businessDay(),groups=new Map(),search=String(query.search||'').trim().toLowerCase();
 for(const row of rows){if(businessDay(row.dueDate)>today||!(row.remainingAmount>0||businessDay(row.dueDate)===today))continue;const key=String(row.loanId);if(!groups.has(key))groups.set(key,{loanId:row.loanId,loanNumber:row.loanNumber,customerName:row.customerName,customerCode:row.customerCode,customerId:row.customerId,overdueMinor:0,todayMinor:0,unpaidMinor:0,installments:[]});const group=groups.get(key);group.installments.push(row);if(businessDay(row.dueDate)<today)group.overdueMinor+=legacyMinor(row.remainingAmount);else{group.todayMinor+=legacyMinor(row.amount);group.unpaidMinor+=legacyMinor(row.remainingAmount);}}
 const result=[...groups.values()].filter(g=>!search||[g.customerName,g.customerCode,g.loanNumber].some(v=>String(v).toLowerCase().includes(search))).map(g=>{const first=g.installments.find(row=>row.canCollect&&!row.collectionLocked);return {...g,previousOverdue:major(g.overdueMinor),todayScheduled:major(g.todayMinor),todayUnpaid:major(g.unpaidMinor),totalCollectible:major(g.overdueMinor+g.unpaidMinor),collectSchedule:first||null};});
 const payments=await require('../models/Collection').find({loanId:{$in:result.map(g=>g.loanId)}}).select('loanId paymentDate status amountReceived').sort({paymentDate:-1}).lean();for(const group of result)group.lastPaymentDate=payments.find(r=>String(r.loanId)===String(group.loanId)&&require('./collectionPerformance.service').validReceipt(r))?.paymentDate||null;
 const notes=await require('../models/OverdueFollowUp').find({loanId:{$in:result.map(g=>g.loanId)},originalDueDate:{$exists:true}}).select('loanId originalDueDate reason followUpDate remarks authorId authorModel createdAt').populate('authorId','name').sort({createdAt:-1}).lean();
 for(const group of result)for(const row of group.installments)row.followUps=notes.filter(note=>String(note.loanId)===String(group.loanId)&&businessDay(note.originalDueDate)===businessDay(row.dueDate));
 const {rows:ignored,employees,...summary}=totals;
 return {summary,rows:result};
}
async function loanView(user,query){
 const date=query.date||businessDay(),filter=query.filter||'ALL';
 if(!['ALL','TODAY','OVERDUE','PAID_TODAY'].includes(filter))throw require('./settlement.service').error(422,'Choose a supported collection filter');
 if(query.search!==undefined&&(typeof query.search!=='string'||query.search.length>100))throw require('./settlement.service').error(422,'Search is limited to 100 characters');
 const data=await require('./employeeDashboard.service').read(user,{date,employeeId:query.employeeId,limit:1},{includeCustomerSummaries:true});
 const {page,limit,skip}=require('./customerPortfolio.service').pageInfo(query),search=(query.search||'').trim().toLocaleLowerCase();
 const all=data.customerSummaries.flatMap(customer=>customer.loans.map(loan=>{
  const due=loan.installments.filter(row=>row.activeAtDate&&businessDay(row.dueDate)<=date),overdue=due.filter(row=>businessDay(row.dueDate)<date),today=due.filter(row=>businessDay(row.dueDate)===date);
  const sum=(rows,key)=>major(rows.reduce((n,r)=>n+legacyMinor(r[key]||0),0));
  const previousOverdue=sum(overdue,'remaining'),todayUnpaid=sum(today,'remaining'),totalCollectible=major(legacyMinor(previousOverdue)+legacyMinor(todayUnpaid)),received=sum(loan.installments,'actualReceived');
  const receipts=[...new Map(loan.installments.flatMap(r=>r.receiptSummaries||[]).map(r=>[String(r._id),r])).values()].sort((a,b)=>new Date(b.paymentDate)-new Date(a.paymentDate)||new Date(b.recordedAt||0)-new Date(a.recordedAt||0));
  return {...loan,customerId:customer.customerId,customerName:customer.customerName,customerCode:customer.customerCode,mobile:customer.mobile,previousOverdue,todayUnpaid,totalCollectible,received,collectSchedule:loan.currentSchedule,latestReceipt:receipts[0]||null,status:previousOverdue>0?'Overdue':todayUnpaid>0?(today.some(r=>r.paidAmount>0)?'Partially Paid':'Due Today'):due.length&&due.every(r=>r.remaining===0)?'Paid':'Upcoming',activeAtDate:loan.installments.some(r=>r.activeAtDate)&&(!loan.installments[0]?.currentSchedule?.loanIssueDate||businessDay(loan.installments[0].currentSchedule.loanIssueDate)<=date),requiresHistoryReview:due.some(r=>r.requiresHistoryReview)};
 })).filter(loan=>loan.activeAtDate||loan.received>0);
 const sum=(key)=>major(all.reduce((n,r)=>n+legacyMinor(r[key]||0),0));
 const summary={date,totalCustomers:new Set(all.filter(r=>r.activeAtDate).map(r=>r.customerId)).size,previousOverdue:sum('previousOverdue'),todayUnpaid:sum('todayUnpaid'),totalCollectible:sum('totalCollectible'),collected:data.collected};
 const searched=all.filter(r=>!search||[r.customerName,r.customerCode,r.mobile,r.loanNumber].some(v=>String(v||'').toLocaleLowerCase().includes(search)));
 const matches=(r,f)=>f==='ALL'||f==='TODAY'&&r.todayUnpaid>0||f==='OVERDUE'&&r.previousOverdue>0||f==='PAID_TODAY'&&r.received>0;
 const counts=Object.fromEntries(['ALL','TODAY','OVERDUE','PAID_TODAY'].map(f=>[f,searched.filter(r=>matches(r,f)).length]));
 const filtered=searched.filter(r=>matches(r,filter));
 return {date,summary,counts,rows:filtered.slice(skip,skip+limit),meta:{page,limit,total:filtered.length,totalPages:Math.ceil(filtered.length/limit)}};
}
module.exports={read};
