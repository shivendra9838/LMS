const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

const findUserByEmail = async (email) => {
  // Check Admin collection first
  let user = await Admin.findOne({ email });
  if (user) return user;
  
  // If not admin, check Employee collection
  user = await Employee.findOne({ email });
  return user;
};

module.exports = { findUserByEmail };
