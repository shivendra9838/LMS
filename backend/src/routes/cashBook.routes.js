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

router.use(authenticate, authorizeRoles('ADMIN'));

router.get('/', getCashBookListController);
router.get('/dashboard', getCashBookDashboardController);
router.post('/opening-balance', setOpeningBalanceController);
router.post('/manual-entry', addManualCashEntryController);
router.get('/:date', getCashBookDayController);

module.exports = router;
