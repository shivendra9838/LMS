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
  const pageNumber=Number(page),pageSize=Number(limit);
  if(!Number.isInteger(pageNumber)||pageNumber<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>200)throw Object.assign(new Error('Use a page size between 1 and 200'),{status:422});
  if(query.status){if(!['ACTIVE','INACTIVE'].includes(query.status))throw Object.assign(new Error('Choose active or inactive employees'),{status:422});filter.status=query.status;}
  if(query.branchId){if(!require('mongoose').isValidObjectId(query.branchId))throw Object.assign(new Error('Choose a valid branch'),{status:422});filter.branchId=query.branchId;}
  if (search) {
    if(typeof search!=='string'||search.length>100)throw Object.assign(new Error('Search is limited to 100 characters'),{status:422});
    filter.$or=['name','employeeCode','phone','email'].map(field=>({[field]:{$gte:search.trim(),$lt:search.trim()+'\uffff'}}));
  }

  const sortOptions = {};
  if (sort) {
    if(!['name','employeeCode','createdAt','status'].includes(sort))throw Object.assign(new Error('Choose a valid employee sort'),{status:422});
    sortOptions[sort] = 1; // default to ascending
  } else {
    sortOptions.createdAt = -1;
  }
  sortOptions._id=1;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const employees = await Employee.find(filter)
    .select('employeeCode name email pendingEmail phone city branchId area status role joiningDate')
    .collation({locale:'en',strength:2})
    .populate('branchId', 'name areas status')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Employee.countDocuments(filter).collation({locale:'en',strength:2});
  const photos=await require('../models/AccountSettings').find({role:'EMPLOYEE',userId:{$in:employees.map(e=>e._id)},photoType:{$exists:true}}).select('userId').lean();
  const photoIds=new Set(photos.map(p=>String(p.userId)));

  return {
    employees:employees.map(e=>({...e.toObject(),hasPhoto:photoIds.has(String(e._id))})),
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit))
  };
};

const getEmployeeById = async (id) => {
  return await Employee.findById(id).select('-password -__v +emailVerification').populate('branchId', 'name areas status');
};

const updateEmployeeById = async (id, updateData) => {
  return await Employee.findByIdAndUpdate(id, { $set: updateData, $inc: { authVersion: 1 } }, { new: true, runValidators: true }).select('-password -__v');
};

const updateEmployeeStatusById = async (id, status) => {
  return await Employee.findByIdAndUpdate(id, { $set: { status }, $inc: { authVersion: 1 } }, { new: true, runValidators: true }).select('-password -__v');
};

const resetEmployeePasswordById = async (id, password) => {
  const employee = await Employee.findById(id).select('+authVersion');
  if (!employee) {
    return null;
  }

  employee.password = password;
  employee.authVersion = (employee.authVersion || 0) + 1;
  employee.passwordReset = undefined;
  await employee.save();

  return employee.toObject();
};

const getEmployeeStats = async () => {
  const totalEmployees = await Employee.countDocuments();
  const activeEmployees = await Employee.countDocuments({ status: 'ACTIVE' });
  const inactiveEmployees = await Employee.countDocuments({ status: 'INACTIVE' });
  const {businessDay,dayStart}=require('../utils/businessDay'),today=businessDay(),from=today.slice(0,7)+'-01',next=new Date(from+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
  const joinedThisMonth=await Employee.countDocuments({joiningDate:{$gte:dayStart(from),$lt:dayStart(next.toISOString().slice(0,10))}});
  return { totalEmployees, activeEmployees, inactiveEmployees, joinedThisMonth };
};

module.exports = { findByEmailOrPhone, createEmployee, getEmployees, getEmployeeById, updateEmployeeById, updateEmployeeStatusById, resetEmployeePasswordById, getEmployeeStats };
