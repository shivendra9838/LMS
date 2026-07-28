const cron = require('node-cron');
const mongoose = require('mongoose');
const LoanSchedule = require('../models/LoanSchedule');
const { recordCollectionService } = require('../services/collection.service');
const Employee = require('../models/Employee');

// We need a dummy "SYSTEM" user for the service, or we can find an admin
// Actually, it's safer to bypass authorization inside the cron if we adapt the service, or just find the first admin.
const processMissedPayments = async () => {
  console.log('--- Starting End-Of-Day Cron Job: Processing Missed Payments ---');
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Find all schedules for today that are still PENDING
    const pendingSchedules = await LoanSchedule.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'PENDING'
    });

    if (pendingSchedules.length === 0) {
      console.log('No pending schedules found for today. End of cron job.');
      return;
    }

    console.log(`Found ${pendingSchedules.length} pending schedule(s). Converting to MISSED...`);

    // Use a SYSTEM user to bypass employee-specific authorization checks
    const systemUser = { id: 'SYSTEM', role: 'SYSTEM' };

    let successCount = 0;
    let failCount = 0;

    for (const sch of pendingSchedules) {
      try {
        await recordCollectionService({
          loanScheduleId: sch._id,
          isMissed: true,
          remarks: 'System: Auto-marked missed at End-of-Day'
        }, systemUser);
        successCount++;
      } catch (err) {
        console.error(`Failed to mark schedule ${sch._id} as MISSED:`, err.message);
        failCount++;
      }
    }

    console.log(`Cron execution completed. Successfully marked: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error('Error in End-Of-Day Cron Job:', error);
  }
};

const initCronJobs = () => {
  // Schedule to run every day at 21:00 (9:00 PM)
  cron.schedule('0 21 * * *', processMissedPayments);
  console.log('Cron jobs initialized. End-of-Day Missed Payment Processor scheduled for 9 PM daily.');
};

module.exports = {
  initCronJobs,
  processMissedPayments
};
