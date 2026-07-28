const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getAdminDashboard } = require('../controllers/admin.controller');

router.get('/dashboard', authenticate, authorizeRoles('ADMIN'), getAdminDashboard);

module.exports = router;
