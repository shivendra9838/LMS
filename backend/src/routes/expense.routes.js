const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const {
  createExpenseController,
  getExpenseListController,
  getExpenseController,
  updateExpenseController,
  deleteExpenseController,
  getExpenseReportController
} = require('../controllers/expense.controller');

router.use(authenticate, authorizeRoles('ADMIN'));

router.post('/', createExpenseController);
router.get('/', getExpenseListController);
router.get('/report', getExpenseReportController);
router.get('/:id', getExpenseController);
router.put('/:id', updateExpenseController);
router.delete('/:id', deleteExpenseController);

module.exports = router;
