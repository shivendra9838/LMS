const { findByEmailOrPhone, createEmployee } = require('../repositories/employee.repository');
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

module.exports = { createEmployeeService };
