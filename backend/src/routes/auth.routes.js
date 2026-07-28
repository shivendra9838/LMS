const express = require('express');
const router = express.Router();
const { login } = require('../controllers/auth.controller');
const { validateLogin } = require('../validators/auth.validator');

router.post('/login', validateLogin, login);

module.exports = router;
