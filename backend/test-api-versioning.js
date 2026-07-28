const http = require('http');
const axios = require('axios');
const assert = require('assert');
const app = require('./src/app');

async function testApiVersioning() {
  let server;

  try {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseURL = `http://localhost:${port}`;

    console.log('\n--- Step 1: Old route should return 404 ---');
    try {
      await axios.get(`${baseURL}/api/health`);
      throw new Error('Old route /api/health should not return 200');
    } catch (error) {
      assert.strictEqual(error.response.status, 404);
      console.log('PASS: /api/health returned 404');
    }

    console.log('\n--- Step 2: New v1 route should return 200 ---');
    const healthRes = await axios.get(`${baseURL}/api/v1/health`);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.data.status, 'OK');
    console.log('PASS: /api/v1/health returned 200');

    console.log('\nAPI Versioning tests passed.');
  } catch (err) {
    process.exitCode = 1;
    console.error('\nAPI Versioning Test Error:', err.response?.data || err.message);
  } finally {
    if (server) server.close();
    console.log('\nAPI Versioning tests finished.');
  }
}

testApiVersioning();
