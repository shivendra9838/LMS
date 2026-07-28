const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { createCustomerController, getCustomerListController, getCustomerController, updateCustomerController, updateCustomerStatusController, getCustomerTimelineController } = require('../controllers/customer.controller');
const { validateCreateCustomer, validateUpdateCustomer } = require('../validators/customer.validator');

router.post('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCreateCustomer, createCustomerController);
router.get('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getCustomerListController);
router.get('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getCustomerController);
router.get('/:id/timeline', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getCustomerTimelineController);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateUpdateCustomer, updateCustomerController);
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), updateCustomerStatusController);

module.exports = router;
