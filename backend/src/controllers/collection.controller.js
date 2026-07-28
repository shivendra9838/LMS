const { getTodayCollectionService, recordCollectionService, getCollectionHistoryService, getCollectionReceiptService } = require('../services/collection.service');

const getTodayCollection = async (req, res, next) => {
  try {
    const data = await getTodayCollectionService(req.user);
    res.status(200).json({
      success: true,
      message: 'Today\'s collection fetched successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const recordCollection = async (req, res, next) => {
  try {
    const data = await recordCollectionService(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Collection recorded successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getCollectionHistory = async (req, res, next) => {
  try {
    const data = await getCollectionHistoryService(req.params.loanId, req.user);
    res.status(200).json({
      success: true,
      message: 'Collection history fetched successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

const getCollectionReceipt = async (req, res, next) => {
  try {
    const data = await getCollectionReceiptService(req.params.collectionId, req.user);
    res.status(200).json({
      success: true,
      message: 'Collection receipt fetched successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTodayCollection,
  recordCollection,
  getCollectionHistory,
  getCollectionReceipt
};
