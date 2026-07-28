const express = require('express');
const router = express.Router();
const { createEmployee, getEmployeeList, getEmployee } = require('../controllers/employee.controller');
const { validateCreateEmployee } = require('../validators/employee.validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.post('/', authenticate, authorizeRoles('ADMIN'), validateCreateEmployee, createEmployee);
router.get('/', authenticate, authorizeRoles('ADMIN'), getEmployeeList);
router.get('/:id', authenticate, authorizeRoles('ADMIN'), getEmployee);

module.exports = router;
