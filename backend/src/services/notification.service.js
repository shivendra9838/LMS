const Notification=require('../models/Notification');
const {getTodayCollectionsForEmployee}=require('../repositories/collection.repository');
const {bounds}=require('../utils/businessDay');
const LoanSchedule=require('../models/LoanSchedule');
const getAdminNotificationsService=async user=>{
 if(user.role!=='ADMIN')throw Object.assign(new Error('Only admins can view missed payments'),{status:403});
 const {start}=bounds();
 // Derive unresolved arrears from schedules; notifications/jobs are not the financial source of truth.
 const rows=await LoanSchedule.aggregate([
  {$match:{date:{$lt:start},$expr:{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}}},
  {$lookup:{from:'loans',localField:'loanId',foreignField:'_id',as:'loan'}},{$unwind:'$loan'},
  {$match:{'loan.status':{$in:require('./overdue.service').OPEN_STATUSES},'loan.remainingAmount':{$gt:0}}},
  {$lookup:{from:'customers',localField:'loan.customerId',foreignField:'_id',as:'customer'}},{$unwind:{path:'$customer',preserveNullAndEmptyArrays:true}},
  {$lookup:{from:'employees',localField:'loan.employeeId',foreignField:'_id',as:'employee'}},{$unwind:{path:'$employee',preserveNullAndEmptyArrays:true}},
  {$project:{loanId:1,loanNumber:'$loan.loanNumber',dayNumber:1,dueDate:'$date',createdAt:'$date',remainingAmount:{$subtract:['$amount',{$ifNull:['$paidAmount',0]}]},customerName:'$customer.name',employeeName:'$employee.name',status:{$literal:'UNRESOLVED'},type:{$literal:'MISSED_PAYMENT'}}},{$sort:{dueDate:1,_id:1}}
 ]);
 const arrears=rows.map(row=>({...row,title:`Overdue installment · ${row.loanNumber}`,message:`${row.customerName||'Customer'} · Day ${row.dayNumber} · INR ${row.remainingAmount.toFixed(2)} still due · Employee: ${row.employeeName||'Assignment requires review'}`}));
 const general=await Notification.find({type:'GENERAL'}).sort({createdAt:-1}).limit(50).lean();
 return [...arrears,...general];
};
module.exports={getAdminNotificationsService};
