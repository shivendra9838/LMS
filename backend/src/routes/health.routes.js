const express = require('express');
const router = express.Router();

const { checkHealth } = require('../controllers/health.controller');

router.get('/', checkHealth);

module.exports = router;
