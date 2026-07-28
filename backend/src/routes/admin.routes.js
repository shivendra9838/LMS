const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

router.get('/dashboard', authenticate, authorizeRoles('ADMIN'), (req, res) => {
  res.status(200).json({ success: true, message: 'Welcome to Admin Dashboard' });
});

module.exports = router;
