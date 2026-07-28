const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { createCustomerController, getCustomerListController, getCustomerController, updateCustomerController, updateCustomerStatusController, getCustomerTimelineController } = require('../controllers/customer.controller');
const {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateCustomerStatus,
  validateCustomerId,
  validateCustomerList
} = require('../validators/customer.validator');

router.post('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCreateCustomer, createCustomerController);
router.get('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerList, getCustomerListController);
router.get('/:id/timeline', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, getCustomerTimelineController);
router.get('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, getCustomerController);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, validateUpdateCustomer, updateCustomerController);
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, validateCustomerStatus, updateCustomerStatusController);

module.exports = router;
