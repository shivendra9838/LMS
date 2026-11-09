const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { getTodayCollection, recordCollection, getCollectionHistory, getCollectionReceipt } = require('../controllers/collection.controller');
const { validateCollection } = require('../validators/collection.validator');

const review=require('../services/customerPaymentReview.service');
router.get('/recovery',authenticate,async(req,res,next)=>{try{res.set('Cache-Control','no-store');res.json({success:true,data:await require('../services/collectionRecovery.service').read(req.user,req.query)});}catch(error){next(error);}});
const reviewHandler=fn=>async(req,res,next)=>{try{res.json({success:true,data:await fn(req)});}catch(error){next(error);}};
router.get('/tracking',authenticate,reviewHandler(req=>review.tracking(req.user,req.query)));
router.get('/installments/:scheduleId/history',authenticate,reviewHandler(req=>review.history(req.params.scheduleId,req.user)));
router.get('/installments/:scheduleId/allocation-preview',authenticate,(req,res,next)=>{res.set('Cache-Control','no-store');next();},reviewHandler(req=>require('../services/collectionAllocationPreview.service')(req.params.scheduleId,req.query.amount,req.user,req.query.paymentDate)));
router.get('/installments/:scheduleId/payment-reviews',authenticate,reviewHandler(req=>review.details(req.params.scheduleId,req.user)));
router.post('/receipt/:collectionId/verify',authenticate,reviewHandler(req=>review.verify(req.params.collectionId,req.user,req.body)));

// GET /api/collections/today
router.get('/today', authenticate, getTodayCollection);
router.get('/installments', authenticate, require('../controllers/collection.controller').getInstallments);

// GET /api/collections/history/:loanId
router.get('/history/:loanId', authenticate, getCollectionHistory);

// GET /api/collections/receipt/:collectionId
router.get('/receipt/:collectionId', authenticate, getCollectionReceipt);
router.get('/receipt/:collectionId/pdf',authenticate,async(req,res,next)=>{try{const receipt=await require('../services/collection.service').getCollectionReceiptService(req.params.collectionId,req.user);const bytes=await require('../services/paymentReceiptPdf.service').generate(receipt);res.set('Cache-Control','no-store');res.type('application/pdf');res.set('Content-Disposition',`attachment; filename="receipt-${String(receipt.collectionNumber).replace(/[^a-zA-Z0-9_-]/g,'')}.pdf"`);res.send(bytes);}catch(error){next(error);}});

// POST /api/collections
router.post('/', authenticate, validateCollection, recordCollection);

module.exports = router;
