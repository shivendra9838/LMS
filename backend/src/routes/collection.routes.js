const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { getTodayCollection, recordCollection, getCollectionHistory, getCollectionReceipt } = require('../controllers/collection.controller');
const { validateCollection } = require('../validators/collection.validator');

// GET /api/collections/today
router.get('/today', authenticate, getTodayCollection);

// GET /api/collections/history/:loanId
router.get('/history/:loanId', authenticate, getCollectionHistory);

// GET /api/collections/receipt/:collectionId
router.get('/receipt/:collectionId', authenticate, getCollectionReceipt);

// POST /api/collections
router.post('/', authenticate, validateCollection, recordCollection);

module.exports = router;
