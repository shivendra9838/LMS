const { getEmployeeStatsService } = require('../services/employee.service');

const getAdminDashboard = async (req, res, next) => {
  try {
    const stats = await getEmployeeStatsService();
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminDashboard };
