const { getAdminNotificationsService } = require('../services/notification.service');

const getAdminNotifications = async (req, res, next) => {
  try {
    const data = await getAdminNotificationsService(req.user);
    res.status(200).json({
      success: true,
      message: 'Notifications fetched successfully',
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminNotifications
};
