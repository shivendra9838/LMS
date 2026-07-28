const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const reportValidator = require('../validators/report.validator');

// All reports are accessible only by ADMIN
router.use(authenticate, authorize(['ADMIN']));

router.get('/daily', reportValidator.validateReportFilters, validate, reportController.getDailyReports);
router.get('/employees', reportValidator.validateReportFilters, validate, reportController.getEmployeeReports);
router.get('/area', reportValidator.validateReportFilters, validate, reportController.getAreaReports);
router.get('/outstanding', reportValidator.validateReportFilters, validate, reportController.getOutstandingReports);
router.get('/collection', reportValidator.validateReportFilters, validate, reportController.getCollectionReports);
router.get('/export/:type', reportController.exportReports);

module.exports = router;
