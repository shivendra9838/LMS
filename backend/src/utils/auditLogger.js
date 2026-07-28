const AuditLog = require('../models/AuditLog');

const createAuditLog = async (req, { action, module, referenceId, oldValue, newValue }) => {
  try {
    const user = req?.user || { id: null, role: 'SYSTEM' };
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';
    const device = req?.headers?.['user-agent'] || 'Unknown Device';

    let userModel = 'Admin';
    if (user.role === 'EMPLOYEE') userModel = 'Employee';
    else if (user.role === 'SYSTEM') userModel = 'SYSTEM';

    await AuditLog.create({
      userId: user.id || user._id || null,
      userModel,
      userRole: user.role || 'UNKNOWN',
      action,
      module,
      referenceId: referenceId ? String(referenceId) : null,
      oldValue,
      newValue,
      ipAddress,
      device
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Non-blocking catch to ensure operational APIs never crash because of log failures
  }
};

module.exports = { createAuditLog };
