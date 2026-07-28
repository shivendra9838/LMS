const {
  createBranch,
  getBranches,
  getBranchById,
  findBranchByName,
  updateBranchById,
  deleteBranchById
} = require('../repositories/branch.repository');

const normalizeAreas = (areas) => {
  if (!Array.isArray(areas)) return [];
  return [...new Set(areas.map(area => String(area).trim()).filter(Boolean))];
};

const ensureBranchArea = (branch, area) => {
  if (!branch) {
    const error = new Error('Branch Not Found');
    error.status = 404;
    throw error;
  }

  if (branch.status !== 'ACTIVE') {
    const error = new Error('Branch is inactive');
    error.status = 400;
    throw error;
  }

  if (area && !branch.areas.includes(area)) {
    const error = new Error('Area does not belong to selected branch');
    error.status = 400;
    throw error;
  }
};

const createBranchService = async (branchData, createdBy) => {
  const name = String(branchData.name || '').trim();
  const areas = normalizeAreas(branchData.areas);

  if (!name) {
    const error = new Error('Branch name is required');
    error.status = 400;
    throw error;
  }

  if (areas.length === 0) {
    const error = new Error('At least one area is required');
    error.status = 400;
    throw error;
  }

  const existing = await findBranchByName(name);
  if (existing) {
    const error = new Error('Branch already exists');
    error.status = 400;
    throw error;
  }

  return await createBranch({
    name,
    areas,
    status: branchData.status || 'ACTIVE',
    createdBy
  });
};

const getBranchListService = async (query) => {
  return await getBranches(query);
};

const getBranchByIdService = async (id) => {
  const branch = await getBranchById(id);
  if (!branch) {
    const error = new Error('Branch Not Found');
    error.status = 404;
    throw error;
  }
  return branch;
};

const updateBranchService = async (id, updateData) => {
  const branch = await getBranchByIdService(id);
  const allowedUpdates = {};

  if (updateData.name !== undefined) {
    const name = String(updateData.name).trim();
    if (!name) {
      const error = new Error('Branch name is required');
      error.status = 400;
      throw error;
    }

    const existing = await findBranchByName(name);
    if (existing && existing._id.toString() !== id.toString()) {
      const error = new Error('Branch already exists');
      error.status = 400;
      throw error;
    }
    allowedUpdates.name = name;
  }

  if (updateData.areas !== undefined) {
    const areas = normalizeAreas(updateData.areas);
    if (areas.length === 0) {
      const error = new Error('At least one area is required');
      error.status = 400;
      throw error;
    }
    allowedUpdates.areas = areas;
  }

  if (updateData.status !== undefined) {
    if (!['ACTIVE', 'INACTIVE'].includes(updateData.status)) {
      const error = new Error('Invalid status');
      error.status = 400;
      throw error;
    }
    allowedUpdates.status = updateData.status;
  }

  return await updateBranchById(branch._id, allowedUpdates);
};

const deleteBranchService = async (id) => {
  await getBranchByIdService(id);
  return await deleteBranchById(id);
};

module.exports = {
  createBranchService,
  getBranchListService,
  getBranchByIdService,
  updateBranchService,
  deleteBranchService,
  ensureBranchArea
};
