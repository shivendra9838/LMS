const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateCollection = [
  body('loanScheduleId').isMongoId().withMessage('Valid Loan Schedule ID is required'),
  body('isMissed').optional().isBoolean(),
  body('amountReceived').if((value, { req }) => !req.body.isMissed).isFloat({ min: 0 }).withMessage('Amount received must be a positive number'),
  body('paymentMode').if((value, { req }) => !req.body.isMissed).isIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).withMessage('Invalid payment mode'),
  body('remarks').optional().isString(),
  validate
];

module.exports = { validateCollection };
