const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const phoneRule = (field = 'phone') => body(field)
  .notEmpty()
  .withMessage('Phone is required')
  .matches(/^[0-9]{10}$/)
  .withMessage('Invalid phone format');

const validateCreateEmployee = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format').normalizeEmail(),
  phoneRule('phone'),
  body('city').if(body('branchId').not().exists()).notEmpty().withMessage('City or branchId is required'),
  body('branchId').optional().isMongoId().withMessage('Valid Branch ID is required'),
  body('area').notEmpty().withMessage('Area is required'),
  validate
];

const validateUpdateEmployee = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Invalid phone format'),
  body('branchId').optional().isMongoId().withMessage('Valid Branch ID is required'),
  body('area').optional().notEmpty().withMessage('Area cannot be empty'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate
];

const validateEmployeeStatus = [
  body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate
];

const validateEmployeeId = [
  param('id').isMongoId().withMessage('Valid Employee ID is required'),
  validate
];

const validateEmployeeList = [
  query('employeeCode').optional().matches(/^EMP[0-9]{4}$/).withMessage('Invalid employee code format'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be greater than 0'),
  query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be greater than 0'),
  validate
];

module.exports = {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateEmployeeStatus,
  validateEmployeeId,
  validateEmployeeList
};
