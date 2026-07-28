const mongoose = require('mongoose');
const packageJson = require('../../package.json');
const { getRequestMetrics } = require('../utils/requestMetrics');

const bytesToMb = (bytes) => Number((bytes / (1024 * 1024)).toFixed(2));

const getStorageUsage = async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      databaseStorageMb: null,
      indexStorageMb: null,
      totalStorageMb: null,
      available: false
    };
  }

  const stats = await mongoose.connection.db.stats();

  return {
    databaseStorageMb: bytesToMb(stats.storageSize || 0),
    indexStorageMb: bytesToMb(stats.indexSize || 0),
    totalStorageMb: bytesToMb((stats.storageSize || 0) + (stats.indexSize || 0)),
    collections: stats.collections,
    objects: stats.objects,
    available: true
  };
};

const getSystemHealthDashboardService = async () => {
  const requestMetrics = getRequestMetrics();
  const memoryUsage = process.memoryUsage();
  const storageUsage = await getStorageUsage();

  return {
    databaseConnected: mongoose.connection.readyState === 1,
    serverRunning: true,
    totalApiRequestsToday: requestMetrics.totalApiRequestsToday,
    failedRequests: requestMetrics.failedRequests,
    storageUsage,
    memoryUsage: {
      rssMb: bytesToMb(memoryUsage.rss),
      heapUsedMb: bytesToMb(memoryUsage.heapUsed),
      heapTotalMb: bytesToMb(memoryUsage.heapTotal)
    },
    lastBackupTime: process.env.LAST_BACKUP_TIME || null,
    applicationVersion: packageJson.version,
    uptimeSeconds: Math.floor(process.uptime()),
    checkedAt: new Date()
  };
};

module.exports = {
  getSystemHealthDashboardService
};
