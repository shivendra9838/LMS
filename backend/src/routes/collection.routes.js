const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { getTodayCollection, recordCollection, getCollectionHistory, getCollectionReceipt } = require('../controllers/collection.controller');
const { validateCollection } = require('../validators/collection.validator');

// GET /api/collections/today
router.get('/today', auth, getTodayCollection);

// GET /api/collections/history/:loanId
router.get('/history/:loanId', auth, getCollectionHistory);

// GET /api/collections/receipt/:collectionId
router.get('/receipt/:collectionId', auth, getCollectionReceipt);

// POST /api/collections
router.post('/', auth, validateCollection, recordCollection);

module.exports = router;
