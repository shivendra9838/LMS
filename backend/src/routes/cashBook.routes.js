const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const {
  getCashBookListController,
  getCashBookDayController,
  setOpeningBalanceController,
  addManualCashEntryController,
  getCashBookDashboardController
} = require('../controllers/cashBook.controller');
const {
  validateOpeningBalance,
  validateManualEntry,
  validateCashBookDate,
  validateCashBookList
} = require('../validators/cashBook.validator');

router.use(authenticate, authorizeRoles('ADMIN'));

router.get('/', validateCashBookList, getCashBookListController);
router.get('/dashboard', getCashBookDashboardController);
router.post('/opening-balance', validateOpeningBalance, setOpeningBalanceController);
router.post('/manual-entry', validateManualEntry, addManualCashEntryController);
router.get('/:date', validateCashBookDate, getCashBookDayController);

module.exports = router;
