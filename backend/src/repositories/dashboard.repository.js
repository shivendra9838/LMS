const Customer=require('../models/Customer'),Employee=require('../models/Employee');
const {metrics}=require('./dashboardAggregates');
const getAdminDashboardStats=async()=>{const [data,totalEmployees,activeEmployees,totalCustomers,activeCustomers]=await Promise.all([metrics(),Employee.countDocuments(),Employee.countDocuments({status:'ACTIVE'}),Customer.countDocuments(),Customer.countDocuments({status:'ACTIVE'})]);return {...data,totalEmployees,activeEmployees,totalCustomers,activeCustomers};};
const getEmployeeDashboardStats=async employeeId=>{const [data,customers]=await Promise.all([metrics(employeeId),Customer.countDocuments({employeeId,status:'ACTIVE'})]);return {...data,myLoans:data.totalLoans,customers,todaysTotalCollection:data.todaysRevenue};};
module.exports={getAdminDashboardStats,getEmployeeDashboardStats};
