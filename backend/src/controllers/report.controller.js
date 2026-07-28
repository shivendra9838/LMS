const { getDailyReportsService, getEmployeeReportsService, getAreaReportsService, getOutstandingReportsService, getCollectionReportsService } = require('../services/report.service');
const { exportToExcel } = require('../utils/excelExport');

const getDailyReports = async (req, res, next) => {
  try {
    const data = await getDailyReportsService(req.query);
    if (req.query.export === 'excel') {
      return exportToExcel(res, data, 'Daily Reports', 'daily_reports');
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getEmployeeReports = async (req, res, next) => {
  try {
    const data = await getEmployeeReportsService(req.query);
    if (req.query.export === 'excel') {
      return exportToExcel(res, data, 'Employee Reports', 'employee_reports');
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getAreaReports = async (req, res, next) => {
  try {
    const data = await getAreaReportsService(req.query);
    if (req.query.export === 'excel') {
      return exportToExcel(res, data, 'Area Reports', 'area_reports');
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getOutstandingReports = async (req, res, next) => {
  try {
    const data = await getOutstandingReportsService(req.query);
    if (req.query.export === 'excel') {
      return exportToExcel(res, data, 'Outstanding Reports', 'outstanding_reports');
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getCollectionReports = async (req, res, next) => {
  try {
    const data = await getCollectionReportsService(req.query);
    if (req.query.export === 'excel') {
      return exportToExcel(res, data, 'Collection Reports', 'collection_reports');
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const { getExportDataService } = require('../services/report.service');
const { createAuditLog } = require('../utils/auditLogger');

const exportReports = async (req, res, next) => {
  try {
    const { type } = req.params;
    const data = await getExportDataService(type, req.query);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${type}-report-${dateStr}`;

    createAuditLog(req, {
      action: 'REPORT_EXPORTED',
      module: 'REPORT',
      newValue: { type, filters: req.query }
    });

    return exportToExcel(res, data, type.toUpperCase(), filename);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailyReports,
  getEmployeeReports,
  getAreaReports,
  getOutstandingReports,
  getCollectionReports,
  exportReports
};
