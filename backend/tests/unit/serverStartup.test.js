jest.mock('../../src/app',()=>({listen:jest.fn()}));
jest.mock('../../src/config/db',()=>jest.fn().mockResolvedValue());
jest.mock('../../src/config/env',()=>({PORT:5000}));
jest.mock('../../src/services/inbox.service',()=>({initialize:jest.fn().mockResolvedValue(),start:jest.fn()}));
jest.mock('../../src/services/emailWorker.service',()=>({initialize:jest.fn().mockResolvedValue(),start:jest.fn()}));
jest.mock('../../src/jobs/endOfDayCron',()=>({initCronJobs:jest.fn()}));
jest.mock('../../src/utils/logger',()=>({setupProcessErrorLogging:jest.fn(),logAccess:jest.fn(),logError:jest.fn()}));
jest.mock('mongoose',()=>({disconnect:jest.fn().mockResolvedValue()}));
const settle=()=>new Promise(resolve=>setImmediate(resolve));
afterEach(()=>{process.exitCode=0;jest.restoreAllMocks();jest.resetModules();});
test('successful port binding precedes workers, cron and running log',async()=>{
 const app=require('../../src/app'),inbox=require('../../src/services/inbox.service'),worker=require('../../src/services/emailWorker.service');
 jest.spyOn(console,'log').mockImplementation(()=>{});
 app.listen.mockImplementation((port,callback)=>{expect(inbox.start).not.toHaveBeenCalled();expect(worker.start).not.toHaveBeenCalled();callback();});
 require('../../src/server');await settle();expect(inbox.start).toHaveBeenCalledTimes(1);expect(worker.start).toHaveBeenCalledTimes(1);expect(require('../../src/utils/logger').logAccess).toHaveBeenCalledWith('SERVER_RUNNING',{port:5000});
});
test('occupied port cannot report a running server or leave duplicate workers active',async()=>{
 const app=require('../../src/app'),error=Object.assign(new Error('Port occupied'),{code:'EADDRINUSE'});app.listen.mockImplementation((port,callback)=>callback(error));
 require('../../src/server');await settle();expect(require('../../src/services/emailWorker.service').start).not.toHaveBeenCalled();expect(require('../../src/jobs/endOfDayCron').initCronJobs).not.toHaveBeenCalled();expect(require('../../src/utils/logger').logAccess).not.toHaveBeenCalled();expect(require('../../src/utils/logger').logError).toHaveBeenCalledWith('SERVER_START_FAILED',error);expect(require('mongoose').disconnect).toHaveBeenCalled();expect(process.exitCode).toBe(1);
});
