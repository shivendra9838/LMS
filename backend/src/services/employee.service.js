const { findByEmailOrPhone, createEmployee, getEmployees, getEmployeeById, updateEmployeeById, updateEmployeeStatusById, resetEmployeePasswordById, getEmployeeStats } = require('../repositories/employee.repository');
const { generateEmployeeCode } = require('../utils/generateCode');
const { getBranchByIdService, ensureBranchArea } = require('./branch.service');

// ... [skipping to bottom for export]
// Wait, I will use a separate replacement chunk for the bottom

const createEmployeeService = async (employeeData, createdBy) => {
  const existingUser = await findByEmailOrPhone(employeeData.email, employeeData.phone);
  if (existingUser) {
    if (existingUser.email === employeeData.email) {
      const error = new Error('Email already exists');
      error.status = 400;
      throw error;
    }
    if (existingUser.phone === employeeData.phone) {
      const error = new Error('Phone already exists');
      error.status = 400;
      throw error;
    }
  }

  const employeeCode = await generateEmployeeCode();
  const password = Math.random().toString(36).slice(-8) + 'A1!'; // Basic complexity logic
  let branch;

  if (employeeData.branchId) {
    branch = await getBranchByIdService(employeeData.branchId);
    ensureBranchArea(branch, employeeData.area);
  }

  const newEmployee = {
    ...employeeData,
    city: employeeData.city || branch?.name,
    employeeCode,
    password,
    createdBy
  };

  const employee = (await createEmployee(newEmployee)).toObject();
  delete employee.password;
  delete employee.__v;

  return {
    employee,
    temporaryPassword: password
  };
};

const getEmployeeListService = async (query) => {
  return await getEmployees(query);
};

const getEmployeeByIdService = async (id) => {
  const employee = await getEmployeeById(id);
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  return employee;
};

const updateEmployeeService = async (id, updateData) => {
  const employee = await getEmployeeById(id);
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  
  if (updateData.phone && updateData.phone !== employee.phone) {
    const existing = await findByEmailOrPhone(null, updateData.phone);
    if (existing && existing._id.toString() !== id.toString()) {
      const error = new Error('Phone already exists');
      error.status = 400;
      throw error;
    }
  }
  
  let branch = null;
  const branchId = updateData.branchId || employee.branchId?._id || employee.branchId;
  const area = updateData.area || employee.area;

  if (branchId) {
    branch = await getBranchByIdService(branchId);
    ensureBranchArea(branch, area);
  }

  const allowedUpdates = {
    name: updateData.name || employee.name,
    phone: updateData.phone || employee.phone,
    branchId,
    area,
    city: updateData.city || branch?.name || employee.city,
    status: updateData.status || employee.status
  };
  if(allowedUpdates.status==='INACTIVE'&&employee.status!=='INACTIVE'){
    const dependencies=await require('./settings.service').dependencies(id);
    if(!dependencies.canDeactivate)throw Object.assign(new Error('Resolve active loans, custody and unresolved settlements before deactivation'),{status:409});
  }

  return await updateEmployeeById(id, allowedUpdates);
};

const updateEmployeeStatusService = async (id, status) => {
  const employee = await getEmployeeById(id);
  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }
  
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    const error = new Error('Invalid status');
    error.status = 400;
    throw error;
  }
  if(status==='INACTIVE'){
    const dependencies=await require('./settings.service').dependencies(id);
    if(!dependencies.canDeactivate)throw Object.assign(new Error('Resolve active loans, custody and unresolved settlements before deactivation'),{status:409});
  }

  return await updateEmployeeStatusById(id, status);
};

const resetEmployeePasswordService = async (id) => {
  const password = Math.random().toString(36).slice(-8) + 'A1!';
  const employee = await resetEmployeePasswordById(id, password);

  if (!employee) {
    const error = new Error('Employee Not Found');
    error.status = 404;
    throw error;
  }

  delete employee.password;
  delete employee.__v;

  return {
    employee,
    temporaryPassword: password
  };
};

const getEmployeeStatsService = async () => {
  return await getEmployeeStats();
};

module.exports = { 
  createEmployeeService, 
  getEmployeeListService, 
  getEmployeeByIdService,
  updateEmployeeService,
  updateEmployeeStatusService,
  resetEmployeePasswordService,
  getEmployeeStatsService
};
