const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getSystemHealthDashboard } = require('../controllers/systemHealth.controller');

router.get('/', authenticate, authorizeRoles('ADMIN'), getSystemHealthDashboard);

module.exports = router;
