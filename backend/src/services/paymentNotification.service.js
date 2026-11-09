const Collection=require('../models/Collection'),Employee=require('../models/Employee'),Customer=require('../models/Customer'),Loan=require('../models/Loan'),Schedule=require('../models/LoanSchedule'),Audit=require('../models/AuditLog');
const id=v=>v?String(v._id||v):null;
const valid=v=>typeof v==='string'&&/^[a-f\d]{24}$/i.test(v);
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
const date=v=>new Date(v).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'});
async function enrich(rows,user){
 const keys=rows.map(r=>/^audit:([a-f\d]{24})$/i.exec(r.eventKey||'')?.[1]).filter(Boolean);
 const events=await Audit.find({_id:{$in:keys},action:{$in:['PAYMENT_RECEIVED','CUSTOMER_PAYMENT_VERIFIED']}}).select('referenceId action').lean(),auditMap=new Map(events.map(e=>[id(e),e]));
 const references=rows.map(row=>{const event=auditMap.get((row.eventKey||'').slice(6)),path=/^\/(admin|employee)\/collections\/receipt\/([a-f\d]{24})$/i.exec(row.path||'');
  // Audit actions and older persisted kinds predate the canonical UI names.
  // Normalize on read, with the committed audit taking precedence over stale labels.
  const verified=event?event.action==='CUSTOMER_PAYMENT_VERIFIED':['CUSTOMER_PAYMENT_VERIFIED','PAYMENT_VERIFIED'].includes(row.kind)||/^(Customer payment verified|Payment verified)/i.test(row.title||'');
  return {row,paymentId:id(row.paymentId)||(valid(event?.referenceId)?event.referenceId:null)||path?.[2],kind:verified?'PAYMENT_VERIFIED':'PAYMENT_RECORDED'};});
 const payments=await Collection.find({_id:{$in:references.map(r=>r.paymentId).filter(valid)},amountReceived:{$gt:0},status:{$in:['PAID','PARTIAL','EXTRA_PAYMENT']},...(user.role==='EMPLOYEE'?{employeeId:user.id}:{})}).select('collectionNumber customerId employeeId collectedBy recordedByRole loanId loanScheduleId allocations amountReceived paymentMode paymentDate createdAt status').lean();
 const [employees,customers,loans,schedules]=await Promise.all([
  Employee.find({_id:{$in:payments.map(p=>p.recordedByRole==='ADMIN'?null:p.collectedBy).filter(Boolean)}}).select('name employeeCode').lean(),
  Customer.find({_id:{$in:payments.map(p=>p.customerId)}}).select('name customerCode').lean(),
  Loan.find({_id:{$in:payments.map(p=>p.loanId)}}).select('loanNumber').lean(),
  Schedule.find({_id:{$in:payments.flatMap(p=>[p.loanScheduleId,...(p.allocations||[]).map(a=>a.scheduleId)])}}).select('loanId dayNumber date').lean()
 ]);
 const map=values=>new Map(values.map(v=>[id(v),v])),em=map(employees),cm=map(customers),lm=map(loans),sm=map(schedules),pm=map(payments);
 return references.map(({row,paymentId,kind})=>{const payment=pm.get(paymentId);const {eventKey,...safe}=row;
  if(!payment)return {...safe,...(paymentId?{paymentUnavailable:true}: {})};
  const employee=em.get(id(payment.collectedBy)),customer=cm.get(id(payment.customerId)),loan=lm.get(id(payment.loanId));
  const days=[...new Set((payment.allocations?.length?payment.allocations.map(a=>a.scheduleId):[payment.loanScheduleId]).map(v=>sm.get(id(v))).filter(s=>s&&id(s.loanId)===id(payment.loanId)).map(s=>s.dayNumber))].sort((a,b)=>a-b);
  const context={paymentId:id(payment),employee:employee?{id:id(employee),name:employee.name,code:employee.employeeCode}:null,recordedByRole:payment.recordedByRole|| (employee?'EMPLOYEE':null),customer:customer?{id:id(customer),name:customer.name,code:customer.customerCode}:null,loan:loan?{id:id(loan),number:loan.loanNumber}:null,installments:days,amount:payment.amountReceived,mode:payment.paymentMode,receivedAt:payment.paymentDate,recordedAt:payment.createdAt,receipt:payment.collectionNumber,status:payment.status};
  const title=(kind==='PAYMENT_VERIFIED'?'Customer payment verified — ':'Payment Received — ')+money(payment.amountReceived);
  const message=`Employee: ${employee?employee.name+' ('+employee.employeeCode+')':payment.recordedByRole==='ADMIN'?'Recorded by Admin':'Unavailable'} · Customer: ${customer?customer.name+' ('+customer.customerCode+')':'Unavailable'} · Loan: ${loan?.loanNumber||'Unavailable'}${days.length?' · Day '+days.join(', '):''} · ${payment.paymentMode||'Mode unavailable'} · Received ${date(payment.paymentDate)} · Receipt ${payment.collectionNumber}`;
  return {...safe,kind,paymentId:id(payment),title,message,paymentContext:context};
 });
}
module.exports={enrich};
