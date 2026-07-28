const {
  getCustomerTimelineService,
  getEmployeeTimelineService,
  getAdminTimelineService
} = require('../services/activityTimeline.service');

const getCustomerTimeline = async (req, res, next) => {
  try {
    const timeline = await getCustomerTimelineService(req.params.id);
    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    next(error);
  }
};

const getEmployeeTimeline = async (req, res, next) => {
  try {
    const timeline = await getEmployeeTimelineService(req.params.id);
    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    next(error);
  }
};

const getAdminTimeline = async (req, res, next) => {
  try {
    const timeline = await getAdminTimelineService();
    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerTimeline,
  getEmployeeTimeline,
  getAdminTimeline
};
