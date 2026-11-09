const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateCreateCustomer = [
  body('name').notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('customerCode').optional().matches(/^CUS[0-9]{6}$/).withMessage('Invalid customer code format'),
  body('mobile').notEmpty().withMessage('Mobile is required').matches(/^[0-9]{10}$/).withMessage('Invalid mobile format'),
  body('address').notEmpty().withMessage('Address is required'),
  body('employeeId').notEmpty().withMessage('Employee allocation is required').isMongoId().withMessage('Valid Employee ID is required'),
  body('age').notEmpty().withMessage('Age is required').isInt({ min: 19 }).withMessage('Age must be greater than 18'),
  validate
];

const validateUpdateCustomer = [
  body('customerCode').optional().matches(/^CUS[0-9]{6}$/).withMessage('Invalid customer code format'),
  body('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Invalid mobile format'),
  body('age').optional().isInt({ min: 19 }).withMessage('Age must be greater than 18'),
  validate
];

const validateCustomerStatus = [
  body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate
];

const validateCustomerId = [
  param('id').isMongoId().withMessage('Valid Customer ID is required'),
  validate
];

const validateCustomerList = [
  query('customerCode').optional().matches(/^CUS[0-9]{6}$/).withMessage('Invalid customer code format'),
  query('employee').optional().matches(/^EMP[0-9]{4}$/).withMessage('Invalid employee code format'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be greater than 0'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be greater than 0'),
  validate
];

module.exports = {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateCustomerStatus,
  validateCustomerId,
  validateCustomerList
};
