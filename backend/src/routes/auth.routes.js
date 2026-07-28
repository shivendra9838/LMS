const express = require('express');
const router = express.Router();
const { login, getMe, logout } = require('../controllers/auth.controller');
const { validateLogin } = require('../validators/auth.validator');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/login', validateLogin, login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

module.exports = router;
