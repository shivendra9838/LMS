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

router.post('/', authenticate, authorizeRoles('ADMIN'), createBranchController);
router.get('/', authenticate, authorizeRoles('ADMIN', 'EMPLOYEE'), getBranchListController);
router.put('/:id', authenticate, authorizeRoles('ADMIN'), updateBranchController);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), deleteBranchController);

module.exports = router;
