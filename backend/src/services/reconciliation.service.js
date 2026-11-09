const mongoose = require('mongoose');
const Position = require('../models/CollectionPosition');
const Settlement = require('../models/EmployeeSettlement');
const Collection = require('../models/Collection');
const Employee = require('../models/Employee');
const { legacyMinor } = require('../utils/money');
const { authorize, objectId, held, error, settlementStatus } = require('./settlement.service');
const timeZone = () => process.env.SETTLEMENT_TIME_ZONE || 'Asia/Kolkata';
function dayStart(day) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'') || !Number.isFinite(Date.parse(day+'T00:00:00Z')) || new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw error(422,'Use a valid YYYY-MM-DD date');
  const target=Date.parse(day+'T00:00:00Z');let guess=target;
  for(let i=0;i<3;i++) {const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timeZone(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess)).map(p=>[p.type,p.value]));const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess=target-(local-guess);}
  return new Date(guess);
}
function range(query) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:timeZone(),year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const from=query.from||today;const to=query.to||from;const start=dayStart(from);dayStart(to);const next=new Date(to+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);const end=dayStart(next.toISOString().slice(0,10));
  if(start>=end || (end-start)>367*86400000)throw error(422,'Choose a date range up to 366 days');
  return {from,to,start,end,today,timeZone:timeZone()};
}
const add=(a,b)=>{const value=a+b;if(!Number.isSafeInteger(value))throw error(422,'Financial report total exceeds safe limits; narrow the filters');return value;};
async function dashboard(query,user,{exportRows=false}={}) {
  await authorize(user);const dates=range(query);const rosterFilter={};
  if(user.role==='EMPLOYEE')rosterFilter._id=objectId(user.id);else if(query.employeeId)rosterFilter._id=objectId(query.employeeId);
  if(query.branchId)rosterFilter.branchId=objectId(query.branchId);
  if(query.area) {if(typeof query.area!=='string'||query.area.length>100)throw error(422,'Invalid area');rosterFilter.area=query.area;}
  if(query.method&&!['CASH','UPI','BANK_TRANSFER','CHEQUE'].includes(query.method))throw error(422,'Invalid payment method');
  if(query.status&&!['SUBMITTED','VERIFIED','REJECTED','DISPUTED','REVERSED'].includes(query.status))throw error(422,'Invalid settlement status');
  if(query.search&&(typeof query.search!=='string'||query.search.length>100))throw error(422,'Search is limited to 100 characters');
  const search=String(query.search||'').toLowerCase();
  const roster=await Employee.find(rosterFilter).select('name employeeCode branchId area').lean();const employeeIds=roster.map(e=>e._id);
  const match={employeeId:{$in:employeeIds}};
  const allPositions=await Position.find(match).populate({path:'collectionId',select:'collectionNumber createdAt backdateReason customerId loanId',populate:[{path:'customerId',select:'name customerCode'},{path:'loanId',select:'loanNumber'}]}).populate('accountId','label owner maskedDetails').sort({paymentDate:-1}).lean();
  for(const position of allPositions)position.recordedAt=position.recordedAt||position.collectionId?.createdAt||position.createdAt;
  for(const position of allPositions)position.settlementStatus=settlementStatus(position);
  const positions=query.method?allPositions.filter(position=>position.method===query.method):allPositions;
  const settlements=await Settlement.find({employeeId:{$in:employeeIds},...(query.status?{status:query.status}:{})}).populate('accountId','label maskedDetails').populate('sourceAccountId','label maskedDetails').populate('reviewedBy','name').sort({occurredAt:-1}).lean();
  const corrections=await Settlement.find({supersedesId:{$in:settlements.map(s=>s._id)}}).select('supersedesId').lean();
  const correctedIds=new Set(corrections.map(s=>String(s.supersedesId)));
  for(const settlement of settlements)settlement.hasCorrection=correctedIds.has(String(settlement._id));
  const totals={collectionsMinor:0,cashCollectedMinor:0,companyUpiMinor:0,employeeUpiMinor:0,bankCollectedMinor:0,unclassifiedMinor:0,cashHeldMinor:0,digitalHeldMinor:0,upiHeldMinor:0,bankHeldMinor:0,availableCashMinor:0,availableDigitalMinor:0,reservedMinor:0,pendingCompanyMinor:0,verifiedCompanyMinor:0,previousOutstandingMinor:0,submittedMinor:0,verifiedSettlementsMinor:0,rejectedMinor:0,disputedMinor:0,cashShortageMinor:0,differenceMinor:0};
  const perEmployee=new Map(roster.map(e=>[String(e._id),{...e,collectionsMinor:0,cashHeldMinor:0,upiHeldMinor:0,bankHeldMinor:0,availableCashMinor:0,availableDigitalMinor:0,unclassifiedMinor:0,pendingCompanyMinor:0}]));
  const within=date=>new Date(date)>=dates.start&&new Date(date)<dates.end;
  for(const p of positions){const row=perEmployee.get(String(p.employeeId));const balance=p.amountMinor-p.settledMinor;const available=balance-p.reservedMinor;
    if(within(p.paymentDate)){totals.collectionsMinor=add(totals.collectionsMinor,p.amountMinor);row.collectionsMinor=add(row.collectionsMinor,p.amountMinor);if(p.method==='CASH')totals.cashCollectedMinor=add(totals.cashCollectedMinor,p.amountMinor);if(p.method==='BANK_TRANSFER')totals.bankCollectedMinor=add(totals.bankCollectedMinor,p.amountMinor);if(p.method==='UPI') {const name=p.bucket==='COMPANY_DIGITAL'?'companyUpiMinor':p.bucket==='UPI_EMPLOYEE'?'employeeUpiMinor':null;if(name)totals[name]=add(totals[name],p.amountMinor);}}
    if(p.bucket==='UNCLASSIFIED'){totals.unclassifiedMinor=add(totals.unclassifiedMinor,p.amountMinor);row.unclassifiedMinor=add(row.unclassifiedMinor,p.amountMinor);}
    if(held.includes(p.bucket)){totals.reservedMinor=add(totals.reservedMinor,p.reservedMinor);if(new Date(p.paymentDate)<dates.start)totals.previousOutstandingMinor=add(totals.previousOutstandingMinor,balance);
      const field=p.bucket==='CASH'?'cashHeldMinor':p.bucket==='UPI_EMPLOYEE'?'upiHeldMinor':'bankHeldMinor';totals[field]=add(totals[field],balance);row[field]=add(row[field],balance);
      const availableField=p.bucket==='CASH'?'availableCashMinor':'availableDigitalMinor';totals[availableField]=add(totals[availableField],available);row[availableField]=add(row[availableField],available);if(p.bucket!=='CASH')totals.digitalHeldMinor=add(totals.digitalHeldMinor,balance);
    }
    if(p.bucket==='COMPANY_DIGITAL'){const field=p.verification==='VERIFIED'?'verifiedCompanyMinor':'pendingCompanyMinor';totals[field]=add(totals[field],p.amountMinor);if(p.verification!=='VERIFIED')row.pendingCompanyMinor=add(row.pendingCompanyMinor,p.amountMinor);}
  }
  // Read-only migration view. Never infer custody or re-post loan balances for old rows.
  const legacy=await Collection.aggregate([{$match:{employeeId:{$in:employeeIds},amountReceived:{$gt:0},...(query.method?{paymentMode:query.method}:{})}},{$lookup:{from:Position.collection.name,localField:'_id',foreignField:'collectionId',as:'position'}},{$match:{position:{$size:0}}},{$project:{collectionNumber:1,employeeId:1,amountReceived:1,paymentMode:1,paymentDate:1,createdAt:1,customerId:1,loanId:1}}]);
  await Collection.populate(legacy,[{path:'customerId',select:'name customerCode'},{path:'loanId',select:'loanNumber'}]);
  for(const c of legacy){const amount=legacyMinor(c.amountReceived);const row=perEmployee.get(String(c.employeeId));totals.unclassifiedMinor=add(totals.unclassifiedMinor,amount);row.unclassifiedMinor=add(row.unclassifiedMinor,amount);if(within(c.paymentDate)){totals.collectionsMinor=add(totals.collectionsMinor,amount);row.collectionsMinor=add(row.collectionsMinor,amount);}}
  const allPositionsById=new Map(positions.map(p=>[String(p._id),p]));
  const visibleSettlements=[];
  for(const s of settlements){const allocated=query.method?s.allocations.reduce((sum,a)=>add(sum,allPositionsById.has(String(a.positionId))?a.amountMinor:0),0):s.amountMinor;if(!allocated)continue;
    if(within(s.occurredAt)&&`${s._id} ${s.reference} ${s.remarks||''}`.toLowerCase().includes(search))visibleSettlements.push({...s,filteredAmountMinor:allocated});
    if(s.status==='SUBMITTED')totals.submittedMinor=add(totals.submittedMinor,allocated);
    if(s.status==='VERIFIED'&&within(s.verifiedAt))totals.verifiedSettlementsMinor=add(totals.verifiedSettlementsMinor,allocated);
    if(s.status==='REJECTED'&&within(s.reviewedAt))totals.rejectedMinor=add(totals.rejectedMinor,allocated);
    if(s.status==='DISPUTED'){totals.disputedMinor=add(totals.disputedMinor,allocated);if(!query.method||allocated===s.amountMinor){totals.differenceMinor=add(totals.differenceMinor,s.differenceMinor||0);if(s.kind==='CASH')totals.cashShortageMinor=add(totals.cashShortageMinor,Math.max(0,s.differenceMinor||0));}}
  }
  const page=Math.max(1,Number(query.page)||1);if(!Number.isInteger(page)||page>100000)throw error(422,'Invalid page');
  const filteredPositions=positions.filter(p=>within(p.paymentDate)&&`${p.collectionId?.collectionNumber} ${p.reference||''}`.toLowerCase().includes(search));
  const legacyPayments=legacy.filter(c=>within(c.paymentDate)&&String(c.collectionNumber||'').toLowerCase().includes(search)).map(c=>({
    _id:`legacy-${c._id}`,collectionId:{_id:c._id,collectionNumber:c.collectionNumber,customerId:c.customerId,loanId:c.loanId},employeeId:c.employeeId,
    paymentDate:c.paymentDate,recordedAt:c.createdAt,method:c.paymentMode,amountMinor:legacyMinor(c.amountReceived),bucket:'UNCLASSIFIED',verification:'PENDING',settlementStatus:'UNCLASSIFIED',legacy:true
  }));
  // Read-only activity includes older collections without inventing custody or settlement eligibility.
  const payments=[...filteredPositions,...legacyPayments].sort((a,b)=>new Date(b.paymentDate)-new Date(a.paymentDate)||String(a._id).localeCompare(String(b._id)));
  const accountBalances=new Map();for(const p of allPositions.filter(p=>['UPI_EMPLOYEE','BANK_EMPLOYEE'].includes(p.bucket))){const key=String(p.accountId?._id);const row=accountBalances.get(key)||{accountId:key,availableMinor:0};row.availableMinor=add(row.availableMinor,p.amountMinor-p.settledMinor-p.reservedMinor);accountBalances.set(key,row);}
  return {dates,totals,accountBalances:[...accountBalances.values()],employees:[...perEmployee.values()],positions:exportRows?filteredPositions:filteredPositions.slice((page-1)*25,page*25),positionsTotal:filteredPositions.length,payments:exportRows?payments:payments.slice((page-1)*25,page*25),paymentsTotal:payments.length,legacyPaymentsInPeriod:legacyPayments.length,settlements:exportRows?visibleSettlements:visibleSettlements.slice((page-1)*25,page*25),settlementsTotal:visibleSettlements.length,legacy:exportRows?legacy:legacy.slice((page-1)*25,page*25),legacyTotal:legacy.length,page,
    notes:['Collections use original payment dates; verified settlements use verification dates.','Liabilities and pending submissions are current all-time balances; dates filter collection activity and submission history.','Branch and area filters use the current employee roster. Method filters apportion mixed digital settlements by allocation. Status filters apply to settlement totals/history; search filters rows only.','Legacy destinations remain unclassified until Admin review. Existing CashBook totals are historical recovery-ledger totals, not physical cash custody.']};
}
module.exports={dashboard,range,dayStart};
