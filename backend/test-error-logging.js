process.env.ENABLE_TEST_ROUTES = 'true';
require('dotenv').config({ path: `${__dirname}/.env` });

const fs = require('fs');
const http = require('http');
const path = require('path');
const axios = require('axios');
const assert = require('assert');
const app = require('./src/app');
const {
  logsDir,
  errorLogPath,
  accessLogPath,
  logAccess,
  logError
} = require('./src/utils/logger');

const waitForLogs = () => new Promise(resolve => setTimeout(resolve, 300));

const readFileIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
};

async function testErrorAndLogging() {
  let server;
  const previousAccess = readFileIfExists(accessLogPath);
  const previousError = readFileIfExists(errorLogPath);

  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}/api/v1`;

    console.log('\n--- Step 1: Internal exception returns clean response ---');
    try {
      await axios.get(`${baseURL}/test-error`);
      throw new Error('Test error route should fail');
    } catch (error) {
      assert.strictEqual(error.response.status, 500);
      assert.deepStrictEqual(error.response.data, {
        success: false,
        message: 'Internal Server Error',
        errors: []
      });
      assert(!JSON.stringify(error.response.data).includes('MongoError'));
      assert(!JSON.stringify(error.response.data).includes('Stack'));
      assert(!JSON.stringify(error.response.data).includes('D:/desktop/LMS'));
    }
    console.log('PASS: Client received clean internal error response');

    console.log('\n--- Step 2: Required logs are generated ---');
    logAccess('USER_LOGIN', { userId: 'test-user' });
    logAccess('FAILED_LOGIN', { email: 'bad@example.com' });
    logAccess('LOAN_CREATED', { loanId: 'loan-test' });
    logAccess('COLLECTION_UPDATED', { collectionId: 'collection-test' });
    logError('UNHANDLED_EXCEPTION', new Error('Unhandled test exception'));

    await waitForLogs();

    const newAccess = readFileIfExists(accessLogPath).slice(previousAccess.length);
    const newError = readFileIfExists(errorLogPath).slice(previousError.length);

    assert(newAccess.includes('API_REQUEST'));
    assert(newAccess.includes('USER_LOGIN'));
    assert(newAccess.includes('FAILED_LOGIN'));
    assert(newAccess.includes('LOAN_CREATED'));
    assert(newAccess.includes('COLLECTION_UPDATED'));
    assert(newError.includes('API_ERROR'));
    assert(newError.includes('UNHANDLED_EXCEPTION'));
    console.log('PASS: access.log and error.log contain required events');

    console.log('\nGlobal error handler and logging tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nError/Logging Test Error:', err.response?.data || err.message);
  } finally {
    if (server) server.close();
    console.log(`\nLogs directory: ${path.relative(process.cwd(), logsDir)}`);
    console.log('\nError/Logging tests finished.');
  }
}

testErrorAndLogging();
