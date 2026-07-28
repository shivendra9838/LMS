const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { getAdminNotifications } = require('../controllers/notification.controller');

// GET /api/notifications
router.get('/', auth, getAdminNotifications);

module.exports = router;
