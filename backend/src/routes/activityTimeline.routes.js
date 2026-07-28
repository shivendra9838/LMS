const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const {
  getCustomerTimeline,
  getEmployeeTimeline,
  getAdminTimeline
} = require('../controllers/activityTimeline.controller');

// GET /api/timeline/customer/:id
router.get('/customer/:id', authenticate, getCustomerTimeline);

// GET /api/timeline/employee/:id
router.get('/employee/:id', authenticate, getEmployeeTimeline);

// GET /api/timeline/admin
router.get('/admin', authenticate, authorizeRoles('ADMIN'), getAdminTimeline);

module.exports = router;
