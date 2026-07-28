const {
  createBranchService,
  getBranchListService,
  updateBranchService,
  deleteBranchService
} = require('../services/branch.service');
const { createAuditLog } = require('../utils/auditLogger');

const createBranchController = async (req, res, next) => {
  try {
    const branch = await createBranchService(req.body, req.user.id);

    createAuditLog(req, {
      action: 'BRANCH_CREATED',
      module: 'BRANCH',
      referenceId: branch._id,
      newValue: branch
    });

    res.status(201).json({
      success: true,
      message: 'Branch Created Successfully',
      data: branch
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getBranchListController = async (req, res, next) => {
  try {
    const branches = await getBranchListService(req.query);
    res.status(200).json({
      success: true,
      data: branches
    });
  } catch (error) {
    next(error);
  }
};

const updateBranchController = async (req, res, next) => {
  try {
    const branch = await updateBranchService(req.params.id, req.body);

    createAuditLog(req, {
      action: 'BRANCH_UPDATED',
      module: 'BRANCH',
      referenceId: branch._id,
      newValue: branch
    });

    res.status(200).json({
      success: true,
      message: 'Branch updated successfully',
      data: branch
    });
  } catch (error) {
    if (error.status || error.name === 'CastError') {
      return res.status(error.status || 404).json({ success: false, message: error.message || 'Branch Not Found' });
    }
    next(error);
  }
};

const deleteBranchController = async (req, res, next) => {
  try {
    const branch = await deleteBranchService(req.params.id);

    createAuditLog(req, {
      action: 'BRANCH_DELETED',
      module: 'BRANCH',
      referenceId: branch._id,
      newValue: { status: branch.status }
    });

    res.status(200).json({
      success: true,
      message: 'Branch deleted successfully',
      data: branch
    });
  } catch (error) {
    if (error.status || error.name === 'CastError') {
      return res.status(error.status || 404).json({ success: false, message: error.message || 'Branch Not Found' });
    }
    next(error);
  }
};

module.exports = {
  createBranchController,
  getBranchListController,
  updateBranchController,
  deleteBranchController
};
