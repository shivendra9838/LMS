const { 
  getDailyReports, getEmployeeReports, getAreaReports, 
  getOutstandingReports, getCollectionReports, getExportData 
} = require('../repositories/report.repository');

const getDailyReportsService = async (filters) => {
  return await getDailyReports(filters);
};

const getEmployeeReportsService = async (filters) => {
  return await getEmployeeReports(filters);
};

const getAreaReportsService = async (filters) => {
  return await getAreaReports(filters);
};

const getOutstandingReportsService = async (filters) => {
  return await getOutstandingReports(filters);
};

const getCollectionReportsService = async (filters) => {
  return await getCollectionReports(filters);
};

const getExportDataService = async (type, filters) => {
  return await getExportData(type, filters);
};

module.exports = {
  getDailyReportsService,
  getEmployeeReportsService,
  getAreaReportsService,
  getOutstandingReportsService,
  getCollectionReportsService,
  getExportDataService
};
