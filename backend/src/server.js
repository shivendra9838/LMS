const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const { initCronJobs } = require('./jobs/endOfDayCron');
const { setupProcessErrorLogging, logAccess, logError } = require('./utils/logger');

setupProcessErrorLogging();

connectDB().catch((error) => {
  logError('DATABASE_CONNECTION_FAILED', error);
});

// Initialize all background jobs
initCronJobs();

app.listen(PORT, () => {
  logAccess('SERVER_RUNNING', { port: PORT });
  console.log(`Server is running on port ${PORT}`);
});
