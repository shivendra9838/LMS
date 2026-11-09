const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const leadFields = [
  body('name').notEmpty().withMessage('Name is required'),
  body('fatherName').notEmpty().withMessage("Father's name is required"),
  body('mobile').notEmpty().matches(/^[0-9]{10}$/).withMessage('Valid 10-digit mobile is required'),
  body('age').isInt({ min: 19 }).withMessage('Age must be greater than 18'),
  body('occupation').notEmpty().withMessage('Occupation is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('area').notEmpty().withMessage('Area is required')
];

const validateSubmitCustomerLead = [...leadFields, validate];

const validateApproveCustomerLead = [
  param('id').isMongoId().withMessage('Valid request ID is required'),
  body('employeeId').isMongoId().withMessage('Select an employee to allocate the customer'),
  body('name').optional().notEmpty(),
  body('fatherName').optional().notEmpty(),
  body('mobile').optional().matches(/^[0-9]{10}$/),
  body('age').optional().isInt({ min: 19 }),
  body('occupation').optional().notEmpty(),
  body('address').optional().notEmpty(),
  body('city').optional().notEmpty(),
  body('area').optional().notEmpty(),
  body('adminRemarks').optional().isString().isLength({ max: 1000 }),
  validate
];

const validateRejectCustomerLead = [
  param('id').isMongoId().withMessage('Valid request ID is required'),
  body('adminRemarks').isString().trim().notEmpty().isLength({ max: 1000 }).withMessage('A rejection reason is required'),
  validate
];

const validateCustomerLeadId = [
  param('id').isMongoId().withMessage('Valid request ID is required'),
  validate
];

const validateCustomerLeadList = [
  query('status').optional().custom((value,{req})=>['DRAFT','PENDING','APPROVED','REJECTED','CORRECTION_REQUIRED'].includes(value)||(value==='ALL'&&req.query.listing==='true')),
  query('listing').optional().isIn(['true','false']),
  query('requestDirectory').optional().isIn(['true','false']),
  query('employeeId').optional().if((_value,{req})=>req.query.requestDirectory==='true').isMongoId().withMessage('Choose a valid referring employee'),
  query('sort').optional().if((_value,{req})=>req.query.requestDirectory==='true').isIn(['newest','oldest']),
  query('startDate').optional().isISO8601({strict:true}).matches(/^\d{4}-\d{2}-\d{2}$/),
  query('endDate').optional().isISO8601({strict:true}).matches(/^\d{4}-\d{2}-\d{2}$/),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('search').optional().isString().isLength({ max: 100 }),
  validate
];

module.exports = {
  validateSubmitCustomerLead,
  validateApproveCustomerLead,
  validateRejectCustomerLead,
  validateCustomerLeadId,
  validateCustomerLeadList
};
