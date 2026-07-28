const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

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

// ==========================================
// 2. ROUTES
// ==========================================
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});
// Future module routes will be mounted here (e.g., app.use('/api/auth', authRoutes))

// ==========================================
// 3. ERROR HANDLER
// ==========================================
// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;
