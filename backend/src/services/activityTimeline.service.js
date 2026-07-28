const activityTimelineRepository = require('../repositories/activityTimeline.repository');

const getCustomerTimelineService = async (customerId) => {
  return await activityTimelineRepository.getTimelineByEntity('CUSTOMER', customerId);
};

const getEmployeeTimelineService = async (employeeId) => {
  return await activityTimelineRepository.getTimelineByEntity('EMPLOYEE', employeeId);
};

const getAdminTimelineService = async () => {
  return await activityTimelineRepository.getAdminTimeline();
};

module.exports = {
  getCustomerTimelineService,
  getEmployeeTimelineService,
  getAdminTimelineService
};
