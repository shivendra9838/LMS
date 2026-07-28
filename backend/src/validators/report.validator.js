const { query } = require('express-validator');

const validateReportFilters = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('export')
    .optional()
    .isIn(['excel'])
    .withMessage('Export type must be excel')
];

module.exports = {
  validateReportFilters
};
