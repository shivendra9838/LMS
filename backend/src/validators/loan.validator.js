const { check, validationResult } = require('express-validator');

const validateCreateLoan = [
  check('customerId').isMongoId().withMessage('Valid Customer ID is required'),
  check('loanAmount').isFloat({ min: 1 }).withMessage('Loan Amount must be greater than 0'),
  check('interestPercent').isFloat({ min: 0.1 }).withMessage('Interest must be greater than 0'),
  check('durationDays').isInt({ min: 1 }).withMessage('Duration must be greater than 0'),
  check('loanDate').isISO8601().withMessage('Valid Loan Date is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

module.exports = {
  validateCreateLoan
};
