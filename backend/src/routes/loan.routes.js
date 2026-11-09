const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { createLoanController, getLoanListController, getLoanController, updateLoanStatusController, getLoanTimelineController } = require('../controllers/loan.controller');
const { validateCreateLoan } = require('../validators/loan.validator');

router.post('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), validateCreateLoan, createLoanController);
router.get('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getLoanListController);
router.get('/:id', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getLoanController);
router.get('/:id/timeline', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getLoanTimelineController);
router.get('/:id/customer-profile',authenticate,authorizeRoles('ADMIN','EMPLOYEE'),async(req,res,next)=>{try{res.set('Cache-Control','no-store');res.json({success:true,data:await require('../services/loanProfile.service').profile(req.params.id,req.user)});}catch(error){next(error);}});
router.patch('/:id/status', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), updateLoanStatusController);

module.exports = router;
