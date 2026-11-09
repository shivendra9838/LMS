const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateCollection = [
  body('loanScheduleId').isMongoId().withMessage('Valid Loan Schedule ID is required'),
  body('isMissed').optional().isBoolean().toBoolean(),
  body('amountReceived').if((value, { req }) => !req.body.isMissed).isFloat({ min: 0 }).withMessage('Amount received must be a positive number'),
  body('paymentMode').if((value, { req }) => !req.body.isMissed).isIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).withMessage('Invalid payment mode'),
  body('remarks').optional().isString().isLength({max:1000}),
  body('paymentDate').optional().isString().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Payment date must be YYYY-MM-DD'),
  body('backdateReason').optional().isString().isLength({max:1000}),
  body('cashReceivedByEmployeeId').optional().isMongoId(),
  body('receivingAccountId').optional().isMongoId(),
  body('transactionReference').optional().isString().isLength({min:3,max:100}),
  body('financeVersion').optional().equals('2').toInt(),
  validate
];

module.exports = { validateCollection };
