const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { requestMetricsMiddleware } = require('./utils/requestMetrics');
const responseFormatter = require('./middlewares/response.middleware');
const { accessLoggerMiddleware } = require('./utils/logger');

const app = express();

// ==========================================
// 1. MIDDLEWARES
// ==========================================
app.use(helmet()); // Security headers
app.use(cors()); // Cross-Origin Resource Sharing
app.use(compression()); // Compress response bodies
app.use(morgan('dev')); // HTTP request logger
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies
app.use(requestMetricsMiddleware); // Track API request and failure counts
app.use(responseFormatter); // Normalize all JSON API responses
app.use(accessLoggerMiddleware); // Persist API access logs

// ==========================================
// 2. ROUTES
// ==========================================
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const employeeRoutes = require('./routes/employee.routes');
const customerRoutes = require('./routes/customer.routes');
const loanRoutes = require('./routes/loan.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const collectionRoutes = require('./routes/collection.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const auditLogRoutes = require('./routes/auditLog.routes');
const activityTimelineRoutes = require('./routes/activityTimeline.routes');
const branchRoutes = require('./routes/branch.routes');
const cashBookRoutes = require('./routes/cashBook.routes');
const systemHealthRoutes = require('./routes/systemHealth.routes');
const expenseRoutes = require('./routes/expense.routes');

const apiV1Prefix = '/api/v1';

app.use(`${apiV1Prefix}/health`, healthRoutes);
app.use(`${apiV1Prefix}/auth`, authRoutes);
app.use(`${apiV1Prefix}/admin`, adminRoutes);
app.use(`${apiV1Prefix}/employees`, employeeRoutes);
app.use(`${apiV1Prefix}/customers`, customerRoutes);
app.use(`${apiV1Prefix}/loans`, loanRoutes);
app.use(`${apiV1Prefix}/dashboard`, dashboardRoutes);
app.use(`${apiV1Prefix}/collections`, collectionRoutes);
app.use(`${apiV1Prefix}/notifications`, notificationRoutes);
app.use(`${apiV1Prefix}/reports`, reportRoutes);
app.use(`${apiV1Prefix}/audit-logs`, auditLogRoutes);
app.use(`${apiV1Prefix}/timeline`, activityTimelineRoutes);
app.use(`${apiV1Prefix}/branches`, branchRoutes);
app.use(`${apiV1Prefix}/cash-book`, cashBookRoutes);
app.use(`${apiV1Prefix}/system-health`, systemHealthRoutes);
app.use(`${apiV1Prefix}/expenses`, expenseRoutes);

if (process.env.ENABLE_TEST_ROUTES === 'true') {
  app.get(`${apiV1Prefix}/test-error`, () => {
    throw new Error('Simulated internal failure with file path D:/desktop/LMS/backend/src/app.js');
  });
}

const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

// ==========================================
// 3. ERROR HANDLER
// ==========================================
app.use(notFound);
app.use(errorHandler);

module.exports = app;
