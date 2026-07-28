const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getAdminDashboardController, getEmployeeDashboardController } = require('../controllers/dashboard.controller');

router.get('/admin', authenticate, authorizeRoles('ADMIN'), getAdminDashboardController);
router.get('/employee', authenticate, authorizeRoles('EMPLOYEE'), getEmployeeDashboardController);

module.exports = router;
