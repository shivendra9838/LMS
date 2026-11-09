const Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Collection=require('../models/Collection'),Customer=require('../models/Customer');
const {businessDay,dayStart,addDays,bounds}=require('../utils/businessDay');
const {legacyMinor,major}=require('../utils/money');
const {scheduleSummary}=require('../services/overdue.service');
const fail=message=>{throw Object.assign(new Error(message),{status:422});};
const sum=(rows,field)=>major(rows.reduce((n,row)=>{const next=n+legacyMinor(typeof field==='function'?field(row):row[field]);if(!Number.isSafeInteger(next))fail('Report exceeds safe monetary limits; narrow the filters');return next;},0));
function reportDates(filters={},fallback) {
 const today=businessDay();let from=filters.date||filters.startDate||filters.from,to=filters.date||filters.endDate||filters.to;
 if(filters.period){if(!['today','yesterday','this_week','this_month'].includes(filters.period))fail('Invalid report period');to=today;from=today;if(filters.period==='yesterday')from=to=addDays(today,-1);if(filters.period==='this_month')from=today.slice(0,8)+'01';if(filters.period==='this_week'){const weekday=new Date(today+'T12:00Z').getUTCDay();from=addDays(today,-((weekday+6)%7));}}
 if(!from&&!to&&fallback){from=fallback==='month'?today.slice(0,8)+'01':today;to=today;}
 if(!from&&!to)return null;
 from=from||to;to=to||from;
 from=String(from).includes('T')?businessDay(from):from;to=String(to).includes('T')?businessDay(to):to;
 const start=dayStart(from),end=dayStart(addDays(to,1));if(start>=end)fail('Report end date must not precede start date');
 return {from,to,start,end};
}
async function load(filters={},fallback) {
 for(const field of ['area','city'])if(filters[field]!==undefined&&(typeof filters[field]!=='string'||filters[field].length>100))fail('Invalid location filter');
 const query={};const mongoose=require('mongoose');
 if(filters.employeeId){if(!mongoose.isValidObjectId(filters.employeeId))fail('Invalid employee filter');query.employeeId=new mongoose.Types.ObjectId(filters.employeeId);}
 if(filters.status&&filters.status!=='OVERDUE'){if(!['ACTIVE','DEFAULTED','COMPLETED','CLOSED','CANCELLED'].includes(filters.status))fail('Invalid loan status');query.status=filters.status;}
 if(filters.area||filters.city){const customers=await Customer.find({...(filters.area?{area:filters.area}:{}),...(filters.city?{city:filters.city}:{})}).select('_id').lean();query.customerId={$in:customers.map(c=>c._id)};}
 let loans=await Loan.find(query).populate('customerId','name customerCode area city').populate('employeeId','name employeeCode').lean();
 let schedules=await Schedule.find({loanId:{$in:loans.map(l=>l._id)}}).lean();
 loans=loans.map(loan=>({...loan,...scheduleSummary(loan,schedules.filter(s=>String(s.loanId)===String(loan._id)))}));
 if(filters.status==='OVERDUE')loans=loans.filter(l=>l.effectiveStatus==='OVERDUE');
 for(const field of ['minOutstanding','maxOutstanding'])if(filters[field]!==undefined&&(!Number.isFinite(Number(filters[field]))||Number(filters[field])<0))fail('Invalid outstanding amount filter');
 loans=loans.filter(l=>(filters.minOutstanding===undefined||l.remainingAmount>=Number(filters.minOutstanding))&&(filters.maxOutstanding===undefined||l.remainingAmount<=Number(filters.maxOutstanding)));
 const ids=loans.map(l=>l._id),idSet=new Set(ids.map(String));schedules=schedules.filter(s=>idSet.has(String(s.loanId)));
 const dates=reportDates(filters,fallback),method=filters.paymentMode||filters.method;
 if(method&&!['CASH','UPI','BANK_TRANSFER','CHEQUE'].includes(method))fail('Invalid payment method filter');
 const collections=await Collection.find({loanId:{$in:ids},amountReceived:{$gt:0},...(method?{paymentMode:method}:{}),...(dates?{paymentDate:{$gte:dates.start,$lt:dates.end}}:{})}).sort({paymentDate:-1}).lean();
 return {loans,schedules,collections,dates,today:businessDay(),todayBounds:bounds()};
}
module.exports={load,sum,reportDates};
