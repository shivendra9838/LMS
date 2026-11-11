const app = require('./app');
const connectDB = require('./config/db');
const { PORT } = require('./config/env');
const { initCronJobs } = require('./jobs/endOfDayCron');
const { setupProcessErrorLogging, logAccess, logError } = require('./utils/logger');

setupProcessErrorLogging();

let server;

async function start(){
 await connectDB();
 const inbox=require('./services/inbox.service');await inbox.initialize();
 const emailWorker=require('./services/emailWorker.service');await emailWorker.initialize();
 // Express 5 also calls the listen callback on failure. Start workers only after a real bind.
 await new Promise((resolve,reject)=>{
  server = app.listen(PORT, error => error ? reject(error) : resolve());
 });
 inbox.start();emailWorker.start();
 initCronJobs();
 logAccess('SERVER_RUNNING',{port:PORT});console.log(`Server is running on port ${PORT}`);
}

const gracefulShutdown = async () => {
 if (server) {
  server.close();
 }
 try {
  await require('mongoose').disconnect();
 } catch {}
 process.exit(0);
};

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);
process.once('SIGUSR2', gracefulShutdown);

start().catch(async error=>{
 console.error(`Server startup failed: ${error.message || error}`);
 if (error.code === 'EADDRINUSE') {
  console.error(`Port ${PORT} is already in use by another process. Stop the running process or choose a different PORT.`);
 }
 logError('SERVER_START_FAILED',error);
 await require('mongoose').disconnect();
 process.exitCode=1;
});
