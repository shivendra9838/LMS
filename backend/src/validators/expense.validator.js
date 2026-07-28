const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const expenseCategories = ['OFFICE_EXPENSE', 'SALARY', 'MISC'];

const validateCreateExpense = [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('category').isIn(expenseCategories).withMessage('Invalid expense category'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('description').notEmpty().withMessage('Description is required'),
  body('paymentMode').optional().isIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).withMessage('Invalid payment mode'),
  validate
];

const validateUpdateExpense = [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('category').optional().isIn(expenseCategories).withMessage('Invalid expense category'),
  body('amount').optional().isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('paymentMode').optional().isIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).withMessage('Invalid payment mode'),
  validate
];

const validateExpenseId = [
  param('id').isMongoId().withMessage('Valid Expense ID is required'),
  validate
];

const validateExpenseQuery = [
  query('from').optional().isISO8601().withMessage('From date must be valid'),
  query('to').optional().isISO8601().withMessage('To date must be valid'),
  query('category').optional().isIn(expenseCategories).withMessage('Invalid expense category'),
  validate
];

module.exports = {
  validateCreateExpense,
  validateUpdateExpense,
  validateExpenseId,
  validateExpenseQuery
};
