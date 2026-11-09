const {load,sum,reportDates}=require('./financialReportData');
const {businessDay}=require('../utils/businessDay');
const {legacyMinor,major}=require('../utils/money');
const inRange=(date,range)=>!range||(new Date(date)>=range.start&&new Date(date)<range.end);
const unpaid=s=>legacyMinor(s.amount)>legacyMinor(s.paidAmount);
const getDailyReports=async(filters={})=>{
 const data=await load(filters);const rows=new Map();
 const row=day=>{if(!rows.has(day))rows.set(day,{date:day,totalDue:0,collected:0,pending:0,missed:0,collectionAmount:0,totalDueAmount:0});return rows.get(day);};
 for(const schedule of data.schedules.filter(s=>inRange(s.date,data.dates))){const r=row(businessDay(schedule.date));r.totalDue++;r.totalDueAmount+=legacyMinor(schedule.amount);if(schedule.paidAmount>0)r.collected++;if(unpaid(schedule)){if(businessDay(schedule.date)<data.today||schedule.status==='MISSED')r.missed++;else r.pending++;}}
 for(const payment of data.collections)row(businessDay(payment.paymentDate)).collectionAmount+=legacyMinor(payment.amountReceived);
 return [...rows.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>({...r,collectionPercentage:r.totalDueAmount?r.collectionAmount/r.totalDueAmount*100:0,totalDueAmount:major(r.totalDueAmount),collectionAmount:major(r.collectionAmount)}));
};
const getEmployeeReports=async(filters={})=>{
 const data=await load(filters,'today');const Employee=require('../models/Employee'),Customer=require('../models/Customer');
 const employees=await Employee.find(filters.employeeId?{_id:filters.employeeId}:{}).select('name employeeCode').lean();
 const photos=await require('../models/AccountSettings').find({userId:{$in:employees.map(e=>e._id)},role:'EMPLOYEE',photoType:{$exists:true}}).select('userId').lean(),photoIds=new Set(photos.map(p=>String(p.userId)));
 const customers=await Customer.find({...(filters.area?{area:filters.area}:{}),...(filters.city?{city:filters.city}:{})}).select('employeeId').lean();
 return employees.map(employee=>{const loans=data.loans.filter(l=>String(l.employeeId?._id)===String(employee._id));const ids=new Set(loans.map(l=>String(l._id)));const schedules=data.schedules.filter(s=>ids.has(String(s.loanId))&&inRange(s.date,data.dates));const collections=data.collections.filter(c=>String(c.employeeId)===String(employee._id));const due=sum(schedules,'amount'),received=sum(collections,'amountReceived');return {_id:employee._id,hasPhoto:photoIds.has(String(employee._id)),employeeCode:employee.employeeCode,name:employee.name,customers:customers.filter(c=>String(c.employeeId)===String(employee._id)).length,loans:loans.filter(l=>['ACTIVE','DEFAULTED'].includes(l.status)).length,todaysCollection:received,pending:schedules.filter(s=>unpaid(s)&&businessDay(s.date)>=data.today&&s.status!=='MISSED').length,missed:data.schedules.filter(s=>ids.has(String(s.loanId))&&unpaid(s)&&businessDay(s.date)<data.today).length,outstanding:sum(loans,'remainingAmount'),overdue:sum(loans,'overdueAmount'),collectionEfficiency:due?received/due*100:0};});
};
const getAreaReports=async(filters={})=>{
 const data=await load(filters,'today'),groups=new Map();
 const customers=await require('../models/Customer').find({...(filters.area?{area:filters.area}:{}),...(filters.city?{city:filters.city}:{}),...(filters.employeeId?{employeeId:filters.employeeId}:{})}).select('city area').lean();
 for(const customer of customers){const key=JSON.stringify([customer.city||'',customer.area||'']);const group=groups.get(key)||{city:customer.city||'',area:customer.area||'',items:[],customerCount:0};group.customerCount++;groups.set(key,group);}
 for(const loan of data.loans){const city=loan.customerId?.city||'',area=loan.customerId?.area||'',key=JSON.stringify([city,area]);if(!groups.has(key))groups.set(key,{city,area,items:[],customerCount:0});groups.get(key).items.push(loan);}
 return [...groups.values()].map(group=>{const ids=new Set(group.items.map(l=>String(l._id))),schedules=data.schedules.filter(s=>ids.has(String(s.loanId)));return {city:group.city,area:group.area,customers:group.customerCount,loans:group.items.filter(l=>['ACTIVE','DEFAULTED'].includes(l.status)).length,outstanding:sum(group.items,'remainingAmount'),overdue:sum(group.items,'overdueAmount'),todaysCollection:sum(data.collections.filter(c=>ids.has(String(c.loanId))),'amountReceived'),pending:schedules.filter(s=>inRange(s.date,data.dates)&&unpaid(s)&&businessDay(s.date)>=data.today&&s.status!=='MISSED').length,missed:schedules.filter(s=>unpaid(s)&&businessDay(s.date)<data.today).length};});
};
const getOutstandingReports=async(filters={})=>{const data=await load(filters);return data.loans.sort((a,b)=>b.remainingAmount-a.remainingAmount).map(l=>({loanNumber:l.loanNumber,customerName:l.customerId?.name||'',employeeName:l.employeeId?.name||'',area:l.customerId?.area||'',outstandingAmount:l.remainingAmount,overdueAmount:l.overdueAmount,remainingDays:l.remainingDays,status:l.status,effectiveStatus:l.effectiveStatus,lastPayment:l.lastPaymentDate}));};
const getCollectionReports=async(filters={})=>{
 const data=await load(filters),rows=data.collections;const bucket=method=>({count:rows.filter(c=>c.paymentMode===method).length,amount:sum(rows.filter(c=>c.paymentMode===method),'amountReceived')});
 return {totalCollections:rows.length,totalAmount:sum(rows,'amountReceived'),breakdown:{cash:bucket('CASH'),upi:bucket('UPI'),bankTransfer:bucket('BANK_TRANSFER'),cheque:bucket('CHEQUE')}};
};
const getExportData=async(type,filters={})=>{
 const data=await load(filters,['daily','monthly'].includes(type)?type==='monthly'?'month':'today':undefined);
 if(['daily','monthly','collections'].includes(type)){const loans=new Map(data.loans.map(l=>[String(l._id),l]));return data.collections.map(c=>{const l=loans.get(String(c.loanId));return {loanNumber:l.loanNumber,customer:l.customerId?.name||'',employee:l.employeeId?.name||'',area:l.customerId?.area||'',expectedAmount:c.expectedAmount,receivedAmount:c.amountReceived,status:c.status,paymentMode:c.paymentMode,date:c.paymentDate,businessDate:businessDay(c.paymentDate),recordedAt:c.createdAt,backdateReason:c.backdateReason||'',installmentsCovered:(c.allocations||[]).map(a=>businessDay(a.dueDate)+': INR '+a.amount).join('; ')};});}
 if(['outstanding','loans'].includes(type))return data.loans.map(l=>({loanNumber:l.loanNumber,customer:l.customerId?.name||'',employee:l.employeeId?.name||'',area:l.customerId?.area||'',loanAmount:l.loanAmount,remainingAmount:l.remainingAmount,overdueAmount:l.overdueAmount,status:l.status,effectiveStatus:l.effectiveStatus,loanDate:l.loanDate}));
 if(type==='customers')return require('../models/Customer').find({...(filters.area?{area:filters.area}:{}),...(filters.city?{city:filters.city}:{}),...(filters.employeeId?{employeeId:filters.employeeId}:{})}).select('customerCode name mobile city area status -_id').lean();
 if(type==='employees')return require('../models/Employee').find(filters.employeeId?{_id:filters.employeeId}:{}).select('employeeCode name phone city area status -_id').lean();
 throw Object.assign(new Error('Unsupported report type'),{status:422});
};
module.exports={getDailyReports,getEmployeeReports,getAreaReports,getOutstandingReports,getCollectionReports,getExportData};
