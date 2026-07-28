const { body, param } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateCreateBranch = [
  body('name').notEmpty().withMessage('Branch name is required'),
  body('areas').isArray({ min: 1 }).withMessage('At least one area is required'),
  body('areas.*').notEmpty().withMessage('Area cannot be empty'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate
];

const validateUpdateBranch = [
  body('name').optional().notEmpty().withMessage('Branch name cannot be empty'),
  body('areas').optional().isArray({ min: 1 }).withMessage('At least one area is required'),
  body('areas.*').optional().notEmpty().withMessage('Area cannot be empty'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  validate
];

const validateBranchId = [
  param('id').isMongoId().withMessage('Valid Branch ID is required'),
  validate
];

module.exports = {
  validateCreateBranch,
  validateUpdateBranch,
  validateBranchId
};
