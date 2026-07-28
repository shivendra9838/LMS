const { getSystemHealthDashboardService } = require('../services/systemHealth.service');

const getSystemHealthDashboard = async (req, res, next) => {
  try {
    const dashboard = await getSystemHealthDashboardService();
    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSystemHealthDashboard
};
