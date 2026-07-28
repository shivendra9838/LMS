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

const notFound = require('./middlewares/notFound.middleware');
const errorHandler = require('./middlewares/error.middleware');

// ==========================================
// 3. ERROR HANDLER
// ==========================================
app.use(notFound);
app.use(errorHandler);

module.exports = app;
