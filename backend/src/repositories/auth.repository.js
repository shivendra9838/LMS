const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

const findUserByEmail = async (email, role) => {
  if (role === 'ADMIN') return Admin.findOne({email}).select('+authVersion');
  if (role === 'EMPLOYEE') return Employee.findOne({email}).select('+authVersion');
  // Check Admin collection first
  let user = await Admin.findOne({ email }).select('+authVersion');
  if (user) return user;
  
  // If not admin, check Employee collection
  user = await Employee.findOne({ email }).select('+authVersion');
  return user;
};

module.exports = { findUserByEmail };
