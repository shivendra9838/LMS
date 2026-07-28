const { createEmployeeService } = require('../services/employee.service');

const createEmployee = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    await createEmployeeService(req.body, adminId);
    
    res.status(201).json({
      success: true,
      message: 'Employee Created'
    });
  } catch (error) {
    if (error.message === 'Email already exists' || error.message === 'Phone already exists') {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

module.exports = { createEmployee };
