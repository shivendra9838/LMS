const Branch = require('../models/Branch');

const createBranch = async (branchData) => {
  const branch = new Branch(branchData);
  return await branch.save();
};

const getBranches = async (query = {}) => {
  const { status, search } = query;
  const filter = {};

  if (status) filter.status = status;
  if (search) filter.name = { $regex: search, $options: 'i' };

  return await Branch.find(filter).sort({ name: 1 });
};

const getBranchById = async (id) => {
  return await Branch.findById(id);
};

const findBranchByName = async (name) => {
  return await Branch.findOne({ name });
};

const updateBranchById = async (id, updateData) => {
  return await Branch.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

const deleteBranchById = async (id) => {
  return await Branch.findByIdAndUpdate(id, { status: 'INACTIVE' }, { new: true, runValidators: true });
};

module.exports = {
  createBranch,
  getBranches,
  getBranchById,
  findBranchByName,
  updateBranchById,
  deleteBranchById
};
