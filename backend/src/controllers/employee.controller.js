const { createEmployeeService, getEmployeeListService, getEmployeeByIdService, updateEmployeeService, updateEmployeeStatusService } = require('../services/employee.service');

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

const updateEmployeeController = async (req, res, next) => {
  try {
    const employee = await updateEmployeeService(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    if (error.message === 'Phone already exists') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const updateEmployeeStatusController = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    const employee = await updateEmployeeStatusService(req.params.id, status);
    res.status(200).json({
      success: true,
      message: 'Employee status updated successfully',
      data: employee
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    if (error.message === 'Invalid status') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

module.exports = { createEmployee, getEmployeeList, getEmployee, updateEmployeeController, updateEmployeeStatusController };
