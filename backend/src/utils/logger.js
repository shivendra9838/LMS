const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../../logs');
const errorLogPath = path.join(logsDir, 'error.log');
const accessLogPath = path.join(logsDir, 'access.log');

const ensureLogsDir = () => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

const safeStringify = (payload) => {
  try {
    return JSON.stringify(payload);
  } catch (error) {
    return JSON.stringify({
      level: 'error',
      event: 'LOG_SERIALIZE_FAILED',
      message: error.message
    });
  }
};

const writeLog = (filePath, payload) => {
  ensureLogsDir();
  fs.appendFile(filePath, `${safeStringify({ timestamp: new Date().toISOString(), ...payload })}\n`, (error) => {
    if (error) {
      console.error('Failed to write log:', error.message);
    }
  });
};

const logAccess = (event, details = {}) => {
  writeLog(accessLogPath, {
    level: 'info',
    event,
    ...details
  });
};

const logError = (event, error, details = {}) => {
  writeLog(errorLogPath, {
    level: 'error',
    event,
    message: error?.message || 'Unknown error',
    name: error?.name,
    stack: error?.stack,
    ...details
  });
};

const accessLoggerMiddleware = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    logAccess('API_REQUEST', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id || null,
      userRole: req.user?.role || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null
    });
  });

  next();
};

const setupProcessErrorLogging = () => {
  process.on('uncaughtException', (error) => {
    logError('UNHANDLED_EXCEPTION', error);
    console.error('Unhandled exception:', error);
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logError('UNHANDLED_REJECTION', error);
    console.error('Unhandled rejection:', error);
  });
};

module.exports = {
  logsDir,
  errorLogPath,
  accessLogPath,
  logAccess,
  logError,
  accessLoggerMiddleware,
  setupProcessErrorLogging
};
