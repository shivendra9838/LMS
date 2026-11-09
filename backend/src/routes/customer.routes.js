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

router.post('/', authenticate, authorizeRoles('ADMIN'), validateCreateCustomer, createCustomerController);
router.get('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerList, getCustomerListController);
router.get('/portfolio/export',authenticate,authorizeRoles('EMPLOYEE'),async(req,res,next)=>{try{const csv=await require('../services/employeeCustomerPortfolio.service').exportCsv(req.query,req.user);res.set('Cache-Control','no-store').type('text/csv').attachment('royal-enterprises-customers.csv').send(csv);}catch(error){next(error);}});
router.get('/portfolio',authenticate,authorizeRoles('EMPLOYEE'),async(req,res,next)=>{try{res.set('Cache-Control','no-store').json({success:true,data:await require('../services/employeeCustomerPortfolio.service').list(req.query,req.user)});}catch(error){next(error);}});
router.get('/:id/timeline', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, getCustomerTimelineController);
router.get('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, getCustomerController);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, validateUpdateCustomer, updateCustomerController);
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCustomerId, validateCustomerStatus, updateCustomerStatusController);

module.exports = router;
