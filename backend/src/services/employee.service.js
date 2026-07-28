const { findByEmailOrPhone, createEmployee, getEmployees, getEmployeeById, updateEmployeeById, updateEmployeeStatusById } = require('../repositories/employee.repository');
const { generateEmployeeCode } = require('../utils/generateCode');

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

  const newEmployee = {
    ...employeeData,
    employeeCode,
    password,
    createdBy
  };

  return await createEmployee(newEmployee);
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

  const allowedUpdates = {
    name: updateData.name || employee.name,
    phone: updateData.phone || employee.phone,
    area: updateData.area || employee.area,
    city: updateData.city || employee.city,
    status: updateData.status || employee.status
  };

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

  return await updateEmployeeStatusById(id, status);
};

module.exports = { 
  createEmployeeService, 
  getEmployeeListService, 
  getEmployeeByIdService,
  updateEmployeeService,
  updateEmployeeStatusService
};
