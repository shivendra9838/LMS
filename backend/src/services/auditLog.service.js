const auditLogRepository = require('../repositories/auditLog.repository');

const fetchAuditLogsService = async (filters) => {
  return await auditLogRepository.getAuditLogs(filters);
};

module.exports = {
  fetchAuditLogsService
};
