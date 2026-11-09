const { logError } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;

  // Handle specific MongoDB errors if needed
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    message = 'Resource not found';
    statusCode = 404;
  }

  logError('API_ERROR', err, {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    userId: req.user?.id || null,
    userRole: req.user?.role || null,
    ipAddress: req.ip
  });

  if (statusCode >= 500) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    errors: statusCode >= 500 ? [] : (err.errors || [])
  });
};

module.exports = errorHandler;
