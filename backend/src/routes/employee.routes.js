const express = require('express');
const router = express.Router();
const {
  createEmployee,
  getEmployeeList,
  getEmployee,
  updateEmployeeController,
  resendVerificationController,
  cancelEmailChangeController,
  updateEmployeeStatusController,
  resetEmployeePasswordController,
  getEmployeeProfile
} = require('../controllers/employee.controller');
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
router.post('/:id/resend-verification', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, resendVerificationController);
router.post('/:id/cancel-email-change', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, cancelEmailChangeController);
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, validateEmployeeStatus, updateEmployeeStatusController);
router.patch('/:id/reset-password', authenticate, authorizeRoles('ADMIN'), validateEmployeeId, resetEmployeePasswordController);

module.exports = router;
