const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const { initCronJobs } = require('./jobs/endOfDayCron');

connectDB();

// Initialize all background jobs
initCronJobs();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
