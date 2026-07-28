const Employee = require('../models/Employee');

const findByEmailOrPhone = async (email, phone) => {
  return await Employee.findOne({ $or: [{ email }, { phone }] });
};

const createEmployee = async (employeeData) => {
  const employee = new Employee(employeeData);
  return await employee.save();
};

module.exports = { findByEmailOrPhone, createEmployee };
