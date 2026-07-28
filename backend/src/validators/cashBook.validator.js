const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateOpeningBalance = [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('openingBalance').isFloat().withMessage('Opening balance is required'),
  validate
];

const validateManualEntry = [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('type').isIn(['MANUAL_INCOME', 'OFFICE_EXPENSE', 'SALARY', 'MISC']).withMessage('Invalid cash book type'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('description').optional().isString().withMessage('Description must be text'),
  validate
];

const validateCashBookDate = [
  param('date').isISO8601().withMessage('Valid date is required'),
  validate
];

const validateCashBookList = [
  query('from').optional().isISO8601().withMessage('From date must be valid'),
  query('to').optional().isISO8601().withMessage('To date must be valid'),
  validate
];

module.exports = {
  validateOpeningBalance,
  validateManualEntry,
  validateCashBookDate,
  validateCashBookList
};
