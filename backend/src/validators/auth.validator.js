const { body } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const validateLogin = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .isString()
    .isLength({max:1000})
    .notEmpty()
    .withMessage('Password is required').hide(),
  validate
];

module.exports = { validateLogin };
