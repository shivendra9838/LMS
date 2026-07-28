const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getAdminNotifications } = require('../controllers/notification.controller');

// GET /api/notifications
router.get('/', authenticate, authorizeRoles('ADMIN'), getAdminNotifications);

module.exports = router;
