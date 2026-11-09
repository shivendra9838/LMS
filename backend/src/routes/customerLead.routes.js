const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const {
  submitCustomerLeadController,
  getCustomerLeadListController,
  getCustomerLeadController,
  approveCustomerLeadController,
  rejectCustomerLeadController
} = require('../controllers/customerLead.controller');
const {
  validateSubmitCustomerLead,
  validateApproveCustomerLead,
  validateRejectCustomerLead,
  validateCustomerLeadId,
  validateCustomerLeadList
} = require('../validators/customerLead.validator');

router.post('/:id/corrections', authenticate, authorizeRoles('ADMIN'), validateCustomerLeadId, async (req, res, next) => {
  try {
    const data = await require('../services/kyc.service').review(req.params.id, req.body, req.user, 'CORRECTION_REQUIRED');
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post(
  '/',
  authenticate,
  authorizeRoles('EMPLOYEE'),
  validateSubmitCustomerLead,
  submitCustomerLeadController
);

router.get(
  '/',
  authenticate,
  authorizeRoles('ADMIN', 'EMPLOYEE'),
  validateCustomerLeadList,
  getCustomerLeadListController
);

router.get(
  '/:id',
  authenticate,
  authorizeRoles('ADMIN', 'EMPLOYEE'),
  validateCustomerLeadId,
  getCustomerLeadController
);

router.post(
  '/:id/approve',
  authenticate,
  authorizeRoles('ADMIN'),
  validateApproveCustomerLead,
  approveCustomerLeadController
);

router.post(
  '/:id/reject',
  authenticate,
  authorizeRoles('ADMIN'),
  validateRejectCustomerLead,
  rejectCustomerLeadController
);

module.exports = router;
