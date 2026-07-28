const { createEmployeeService, getEmployeeListService, getEmployeeByIdService } = require('../services/employee.service');

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

const getEmployeeList = async (req, res, next) => {
  try {
    const result = await getEmployeeListService(req.query);
    res.status(200).json({
      success: true,
      data: result.employees,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

const getEmployee = async (req, res, next) => {
  try {
    const employee = await getEmployeeByIdService(req.params.id);
    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    next(error);
  }
};

module.exports = { createEmployee, getEmployeeList, getEmployee };
