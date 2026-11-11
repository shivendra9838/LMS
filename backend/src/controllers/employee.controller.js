const { 
  createEmployeeService, 
  getEmployeeListService, 
  getEmployeeByIdService, 
  updateEmployeeService, 
  updateEmployeeStatusService, 
  resetEmployeePasswordService,
  resendEmployeeEmailVerification,
  cancelEmployeeEmailVerification
} = require('../services/employee.service');

const createEmployee = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const result = await createEmployeeService(req.body, adminId);
    
    res.status(201).json({
      success: true,
      message: 'Employee Created',
      data: {
        employee: result.employee,
        temporaryPassword: result.temporaryPassword
      }
    });
  } catch (error) {
    if (error.message === 'Email already exists' || error.message === 'Phone already exists') {
      return res.status(error.status || 400).json({
        success: false,
        message: error.message
      });
    }
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
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
    const result = await updateEmployeeService(req.params.id, req.body, req.user?.id, req);
    const employee = result.employee || result;
    const isPending = Boolean(result.emailChangePending);
    await require('../utils/auditLogger').createAuditLog(req,{action:'EMPLOYEE_PROFILE_UPDATED',module:'ACCOUNT',referenceId:req.params.id,newValue:{fields:Object.keys(req.body).filter(k=>['name','email','phone','city','area','branchId','status'].includes(k))}});
    res.status(200).json({
      success: true,
      message: isPending 
        ? 'Employee updated. Verification email sent to new address.' 
        : 'Employee updated successfully',
      data: employee,
      emailChangePending: isPending
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    if (error.message === 'Phone already exists' || error.message === 'Email already exists' || error.message?.includes('already pending verification')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const resendVerificationController = async (req, res, next) => {
  try {
    const result = await resendEmployeeEmailVerification(req.params.id, req.user?.id, req);
    res.status(200).json(result);
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const cancelEmailChangeController = async (req, res, next) => {
  try {
    const result = await cancelEmployeeEmailVerification(req.params.id, req.user?.id, req);
    res.status(200).json(result);
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
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
    await require('../utils/auditLogger').createAuditLog(req,{action:'EMPLOYEE_STATUS_CHANGED',module:'ACCOUNT',referenceId:req.params.id,newValue:{status}});
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

const resetEmployeePasswordController = async (req, res, next) => {
  try {
    const result = await resetEmployeePasswordService(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Employee password reset successfully',
      data: result
    });
  } catch (error) {
    if (error.name === 'CastError' || error.message === 'Employee Not Found') {
      return res.status(404).json({ success: false, message: 'Employee Not Found' });
    }
    next(error);
  }
};

const getEmployeeProfile = async (req, res, next) => {
  try {
    const employee = await getEmployeeByIdService(req.user.id);
    res.status(200).json({
      employeeCode: employee.employeeCode,
      name: employee.name,
      branch: employee.branchId,
      city: employee.city,
      area: employee.area
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createEmployee,
  getEmployeeList,
  getEmployee,
  updateEmployeeController,
  resendVerificationController,
  cancelEmailChangeController,
  updateEmployeeStatusController,
  resetEmployeePasswordController,
  getEmployeeProfile
};
