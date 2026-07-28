const { getAdminDashboardStats, getEmployeeDashboardStats } = require('../repositories/dashboard.repository');

const getAdminDashboardService = async () => {
  return await getAdminDashboardStats();
};

const getEmployeeDashboardService = async (employeeId) => {
  return await getEmployeeDashboardStats(employeeId);
};

module.exports = {
  getAdminDashboardService,
  getEmployeeDashboardService
};
