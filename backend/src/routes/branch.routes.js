const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const {
  createBranchController,
  getBranchListController,
  updateBranchController,
  deleteBranchController
} = require('../controllers/branch.controller');
const { validateCreateBranch, validateUpdateBranch, validateBranchId } = require('../validators/branch.validator');

router.post('/', authenticate, authorizeRoles('ADMIN'), validateCreateBranch, createBranchController);
router.get('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getBranchListController);
router.put('/:id', authenticate, authorizeRoles('ADMIN'), validateBranchId, validateUpdateBranch, updateBranchController);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), validateBranchId, deleteBranchController);

module.exports = router;
