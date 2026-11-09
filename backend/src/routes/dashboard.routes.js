const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getAdminDashboardController, getEmployeeDashboardController } = require('../controllers/dashboard.controller');

router.get('/collection-performance',authenticate,async(req,res,next)=>{try{res.json({success:true,data:await require('../services/collectionPerformance.service').report(req.user,req.query)});}catch(error){next(error);}});
router.get('/employee-workspace',authenticate,authorizeRoles('EMPLOYEE'),async(req,res,next)=>{try{res.json({success:true,data:await require('../services/employeeDashboard.service').read(req.user,req.query)});}catch(error){next(error);}});
router.get('/admin', authenticate, authorizeRoles('ADMIN'), getAdminDashboardController);
router.get('/employee', authenticate, authorizeRoles('EMPLOYEE'), getEmployeeDashboardController);

module.exports = router;
