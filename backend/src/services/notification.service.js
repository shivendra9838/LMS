const Notification = require('../models/Notification');

const getAdminNotificationsService = async (user) => {
  if (user.role !== 'ADMIN') {
    const error = new Error('Only admins can view notifications');
    error.status = 403;
    throw error;
  }

  return await Notification.find()
    .populate('customerId', 'name city area')
    .populate('employeeId', 'name employeeCode')
    .sort({ createdAt: -1 })
    .limit(50);
};

module.exports = {
  getAdminNotificationsService
};
