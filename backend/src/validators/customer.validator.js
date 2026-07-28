const { check, validationResult } = require('express-validator');

const validateCreateCustomer = [
  check('name').notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  check('mobile').notEmpty().withMessage('Mobile is required').matches(/^[0-9]{10}$/).withMessage('Invalid mobile format'),
  check('address').notEmpty().withMessage('Address is required'),
  check('employeeId').optional().isMongoId().withMessage('Valid Employee ID is required'),
  check('age').notEmpty().withMessage('Age is required').isInt({ min: 19 }).withMessage('Age must be greater than 18'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

const validateUpdateCustomer = [
  check('mobile').optional().matches(/^[0-9]{10}$/).withMessage('Invalid mobile format'),
  check('age').optional().isInt({ min: 19 }).withMessage('Age must be greater than 18'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    next();
  }
];

module.exports = { validateCreateCustomer, validateUpdateCustomer };
