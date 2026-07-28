const Employee = require('../models/Employee');

const findByEmailOrPhone = async (email, phone) => {
  return await Employee.findOne({ $or: [{ email }, { phone }] });
};

const createEmployee = async (employeeData) => {
  const employee = new Employee(employeeData);
  return await employee.save();
};

const getEmployees = async (query) => {
  const { search, sort, page = 1, limit = 10 } = query;
  
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { employeeCode: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const sortOptions = {};
  if (sort) {
    sortOptions[sort] = 1; // default to ascending
  } else {
    sortOptions.createdAt = -1;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const employees = await Employee.find(filter)
    .select('employeeCode name city area status -_id')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Employee.countDocuments(filter);

  return {
    employees,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit))
  };
};

const getEmployeeById = async (id) => {
  return await Employee.findById(id).select('-password -__v');
};

const updateEmployeeById = async (id, updateData) => {
  return await Employee.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select('-password -__v');
};

const updateEmployeeStatusById = async (id, status) => {
  return await Employee.findByIdAndUpdate(id, { status }, { new: true }).select('-password -__v');
};

const getEmployeeStats = async () => {
  const totalEmployees = await Employee.countDocuments();
  const activeEmployees = await Employee.countDocuments({ status: 'ACTIVE' });
  const inactiveEmployees = await Employee.countDocuments({ status: 'INACTIVE' });
  return { totalEmployees, activeEmployees, inactiveEmployees };
};

module.exports = { findByEmailOrPhone, createEmployee, getEmployees, getEmployeeById, updateEmployeeById, updateEmployeeStatusById, getEmployeeStats };
