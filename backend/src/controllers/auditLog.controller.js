const { fetchAuditLogsService } = require('../services/auditLog.service');

const getAuditLogs = async (req, res, next) => {
  try {
    const data = await fetchAuditLogsService(req.query);
    res.status(200).json({
      success: true,
      message: 'Audit logs fetched successfully',
      data: data.logs,
      pagination: data.pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
