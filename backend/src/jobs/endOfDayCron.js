const cron=require('node-cron');
const {bounds,TIME_ZONE}=require('../utils/businessDay');
const LoanSchedule=require('../models/LoanSchedule');
// Read-only monitoring: arrears remain derived and visible even after missed job executions.
const processMissedPayments=async()=>{
 const {start}=bounds();
 const pending=await LoanSchedule.countDocuments({date:{$lt:start},$expr:{$gt:['$amount',{$ifNull:['$paidAmount',0]}]}});
 console.log(`Overdue installment monitor: ${pending} unpaid historical schedules; no financial records changed.`);
 return {unpaidSchedules:pending,readOnly:true};
};
const initCronJobs=()=>{cron.schedule('5 0 * * *',()=>processMissedPayments().catch(()=>console.error('Overdue monitoring failed; derived collection lists remain available.')),{timezone:TIME_ZONE});};
module.exports={initCronJobs,processMissedPayments};

