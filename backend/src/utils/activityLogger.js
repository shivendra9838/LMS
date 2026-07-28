const ActivityTimeline = require('../models/ActivityTimeline');

const recordActivity = async ({ entityType, entityId, action, description, performedBy, performerModel = 'Admin', metadata }) => {
  try {
    if (!entityType || !entityId || !action || !description) {
      console.warn('Missing required parameters for recordActivity');
      return;
    }

    await ActivityTimeline.create({
      entityType,
      entityId,
      action,
      description,
      performedBy: performedBy || null,
      performerModel,
      metadata
    });
  } catch (error) {
    console.error('Failed to record activity timeline:', error);
    // Non-blocking catch to ensure main workflows don't break
  }
};

module.exports = { recordActivity };
