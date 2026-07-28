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
const {
  validateCreateExpense,
  validateUpdateExpense,
  validateExpenseId,
  validateExpenseQuery
} = require('../validators/expense.validator');

router.use(authenticate, authorizeRoles('ADMIN'));

router.post('/', validateCreateExpense, createExpenseController);
router.get('/', validateExpenseQuery, getExpenseListController);
router.get('/report', validateExpenseQuery, getExpenseReportController);
router.get('/:id', validateExpenseId, getExpenseController);
router.put('/:id', validateExpenseId, validateUpdateExpense, updateExpenseController);
router.delete('/:id', validateExpenseId, deleteExpenseController);

module.exports = router;
