const Employee = require('../models/Employee');

const generateEmployeeCode = async () => {
  // Find the employee with the highest employeeCode
  const lastEmployee = await Employee.findOne().sort({ employeeCode: -1 });
  
  if (!lastEmployee || !lastEmployee.employeeCode) {
    return 'EMP0001';
  }

  const lastCode = lastEmployee.employeeCode; // e.g. "EMP0005"
  const numericPart = parseInt(lastCode.replace('EMP', ''), 10);
  const nextNumeric = numericPart + 1;
  
  // Pad with leading zeros to maintain a minimum of 4 digits
  const nextCode = `EMP${nextNumeric.toString().padStart(4, '0')}`;
  
  return nextCode;
};

module.exports = { generateEmployeeCode };
