const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getAuditLogs } = require('../controllers/auditLog.controller');

// GET /api/audit-logs
router.get('/', authenticate, authorizeRoles('ADMIN'), getAuditLogs);

module.exports = router;
