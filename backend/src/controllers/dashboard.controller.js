const { getAdminDashboardService, getEmployeeDashboardService } = require('../services/dashboard.service');

const getAdminDashboardController = async (req, res, next) => {
  try {
    const data = await getAdminDashboardService();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getEmployeeDashboardController = async (req, res, next) => {
  try {
    const data = await getEmployeeDashboardService(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminDashboardController,
  getEmployeeDashboardController
};
