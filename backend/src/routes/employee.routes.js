const express = require('express');
const router = express.Router();
const { createEmployee, getEmployeeList, getEmployee, updateEmployeeController, updateEmployeeStatusController, getEmployeeProfile } = require('../controllers/employee.controller');
const {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateEmployeeStatus,
  validateEmployeeId,
  validateEmployeeList
} = require('../validators/employee.validator');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.post('/', authenticate, authorizeRoles('ADMIN'), validateCreateEmployee, createEmployee);
router.get('/', authenticate, authorizeRoles('ADMIN'), validateEmployeeList, getEmployeeList);

// Profile MUST come before /:id to prevent route shadowing
router.get('/profile', authenticate, authorizeRoles('EMPLOYEE'), getEmployeeProfile);

router.get('/:id', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, getEmployee);
router.put('/:id', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, validateUpdateEmployee, updateEmployeeController);
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, validateEmployeeStatus, updateEmployeeStatusController);

module.exports = router;
