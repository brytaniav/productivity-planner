const test = require('node:test');
const assert = require('node:assert/strict');

test('Vercel entry point initializes the task and schedule services', async () => {
  const previousCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: 'demo-project',
    client_email: 'planner@example.com',
    private_key: 'not-used-by-this-request',
  });

  try {
    const handler = require('../api/index.js');
    const req = {
      url: '/api/index?path=unknown',
      method: 'GET',
      headers: { host: 'localhost' },
    };
    const response = { status: null, body: null };
    const res = {
      writeHead(status) { response.status = status; },
      end(body) { response.body = JSON.parse(body); },
      setHeader() {},
    };

    await handler(req, res);

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: 'Not found.' });
  } finally {
    if (previousCredentials === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = previousCredentials;
  }
});
