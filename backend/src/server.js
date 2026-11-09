const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const { initCronJobs } = require('./jobs/endOfDayCron');
const { setupProcessErrorLogging, logAccess, logError } = require('./utils/logger');

setupProcessErrorLogging();

async function start(){
 await connectDB();
 const inbox=require('./services/inbox.service');await inbox.initialize();
 const emailWorker=require('./services/emailWorker.service');await emailWorker.initialize();
 // Express 5 also calls the listen callback on failure. Start workers only after a real bind.
 await new Promise((resolve,reject)=>app.listen(PORT,error=>error?reject(error):resolve()));
 inbox.start();emailWorker.start();
 initCronJobs();
 logAccess('SERVER_RUNNING',{port:PORT});console.log(`Server is running on port ${PORT}`);
}
start().catch(async error=>{logError('SERVER_START_FAILED',error);await require('mongoose').disconnect();process.exitCode=1;});
