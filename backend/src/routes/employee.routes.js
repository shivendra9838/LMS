const express = require('express');
const router = express.Router();
const { createEmployee } = require('../controllers/employee.controller');
const { validateCreateEmployee } = require('../validators/employee.validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.post('/', authenticate, authorizeRoles('ADMIN'), validateCreateEmployee, createEmployee);

module.exports = router;
