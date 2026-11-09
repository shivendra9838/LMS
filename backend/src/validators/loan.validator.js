const { check } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateCreateLoan = [
  check('customerId').isMongoId().withMessage('Valid Customer ID is required'),
  check('loanAmount').isFloat({ min: 1 }).withMessage('Loan Amount must be greater than 0'),
  check('interestPercent').isFloat({ min: 0.1 }).withMessage('Interest must be greater than 0').isFloat({max:1000}).withMessage('Interest cannot exceed 1000 percent'),
  check('durationDays').isInt({ min: 1 }).withMessage('Duration must be greater than 0').isInt({max:3660}).withMessage('Duration cannot exceed 3660 days'),
  check('loanDate').isISO8601({strict:true}).withMessage('Valid Loan Date is required'),
  validate
];

module.exports = {
  validateCreateLoan
};
