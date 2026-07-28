const metrics = {
  currentDate: new Date().toISOString().slice(0, 10),
  totalApiRequestsToday: 0,
  failedRequests: 0
};

const resetIfNewDay = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (metrics.currentDate !== today) {
    metrics.currentDate = today;
    metrics.totalApiRequestsToday = 0;
    metrics.failedRequests = 0;
  }
};

const requestMetricsMiddleware = (req, res, next) => {
  resetIfNewDay();

  if (req.path.startsWith('/api')) {
    metrics.totalApiRequestsToday += 1;

    res.on('finish', () => {
      resetIfNewDay();
      if (res.statusCode >= 400) {
        metrics.failedRequests += 1;
      }
    });
  }

  next();
};

const getRequestMetrics = () => {
  resetIfNewDay();
  return { ...metrics };
};

module.exports = {
  requestMetricsMiddleware,
  getRequestMetrics
};
