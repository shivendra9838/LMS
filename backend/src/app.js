const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { requestMetricsMiddleware } = require('./utils/requestMetrics');

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

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/timeline', activityTimelineRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/cash-book', cashBookRoutes);
app.use('/api/system-health', systemHealthRoutes);
app.use('/api/expenses', expenseRoutes);

const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

// ==========================================
// 3. ERROR HANDLER
// ==========================================
app.use(notFound);
app.use(errorHandler);

module.exports = app;
