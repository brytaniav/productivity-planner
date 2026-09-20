const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreTaskRepository } = require('../public/backend/database/firestore-task-repository');
const { TaskService, QuoteService, PlannerServer } = require('../server');

function response(status, data = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test('quote service reads the supplied API response and rejects invalid data', async () => {
  const service = new QuoteService(async url => {
    assert.equal(url, 'https://motivational-spark-api.vercel.app/api/quotes/2');
    return response(200, { quote: ' Keep going. ', author: ' Someone ' });
  });
  assert.deepEqual(await service.get(), { quote: 'Keep going.', author: 'Someone' });
  await assert.rejects(() => new QuoteService(async () => response(200, { quote: '', author: 'Someone' })).get(), { status: 502 });
});

test('task service validates input and passes a complete task to the repository', async () => {
  const repository = { create: async task => task };
  const service = new TaskService(repository);
  assert.throws(() => service.create({ title: 'x', dueDate: '2026-02-30', owner: 'you', priority: 'high' }), { status: 400 });
  const task = await service.create({ title: '  Plan week  ', dueDate: '2026-09-21', owner: 'partner', priority: 'medium' });
  assert.equal(task.title, 'Plan week');
  assert.equal(task.completed, false);
  assert.equal(task.completedAt, null);
  assert.match(task.id, /^[a-f0-9-]{36}$/);
});

test('Firestore repository reads pages and writes, updates, and deletes documents', async () => {
  const calls = [];
  const id = 'a87b0e83-6f51-4bd5-8120-631a96e62a80';
  const task = { id, title: 'Plan week', dueDate: '2026-09-21', owner: 'partner', priority: 'medium', completed: false, completedAt: null, createdAt: '2026-09-20T00:00:00.000Z' };
  const document = { name: `projects/demo/databases/tasks/documents/tasks/${id}`, ...FirestoreTaskRepository.encodeTask(task) };
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, options });
    if (options.method === 'POST') return response(200, document);
    if (options.method === 'PATCH') return response(200, { ...document, fields: { ...document.fields, completed: { booleanValue: true }, completedAt: { stringValue: '2026-09-20T01:00:00.000Z' } } });
    if (options.method === 'DELETE') return response(200);
    if (parsed.searchParams.has('pageToken')) return response(200, { documents: [document] });
    return response(200, { documents: [document], nextPageToken: 'next' });
  };
  const repository = new FirestoreTaskRepository({ project_id: 'demo', client_email: 'test@example.com', private_key: 'unused' }, { fetchImpl });
  repository.token = 'test-token';
  repository.tokenExpiresAt = Date.now() + 3_600_000;
  assert.deepEqual(await repository.list(), [task, task]);
  assert.deepEqual(await repository.create(task), task);
  assert.equal((await repository.setCompletion(id, true)).completed, true);
  assert.equal(await repository.delete(id), true);
  assert.equal(calls.length, 5);
  assert.equal(calls[2].url.searchParams.get('documentId'), id);
  assert.deepEqual(calls[3].url.searchParams.getAll('updateMask.fieldPaths'), ['completed', 'completedAt']);
  assert.equal(calls[3].url.searchParams.get('currentDocument.exists'), 'true');
  assert.equal(calls[4].url.searchParams.get('currentDocument.exists'), 'true');
});

test('Firestore repository reports missing tasks without hiding database errors', async () => {
  const repository = new FirestoreTaskRepository({ project_id: 'demo', client_email: 'test@example.com', private_key: 'unused' }, { fetchImpl: async () => response(404) });
  repository.token = 'test-token';
  repository.tokenExpiresAt = Date.now() + 3_600_000;
  assert.equal(await repository.setCompletion('missing', true), null);
  assert.equal(await repository.updateDetails('missing', { title: 'New', dueDate: '2026-09-22', owner: 'you', priority: 'low' }), null);
  assert.equal(await repository.delete('missing'), false);
  await assert.rejects(() => repository.list(), /Firestore request failed \(404\)/);
});

test('editing updates task details while leaving completion and creation fields untouched', async () => {
  const id = 'a87b0e83-6f51-4bd5-8120-631a96e62a80';
  const original = { id, title: 'Plan week', dueDate: '2026-09-21', owner: 'you', priority: 'medium', completed: true, completedAt: '2026-09-20T01:00:00.000Z', createdAt: '2026-09-19T00:00:00.000Z' };
  let request;
  const fetchImpl = async (url, options) => {
    request = { url: new URL(url), options };
    return response(200, { name: `projects/demo/databases/tasks/documents/tasks/${id}`, ...FirestoreTaskRepository.encodeTask({ ...original, title: 'Updated', owner: 'partner' }) });
  };
  const repository = new FirestoreTaskRepository({ project_id: 'demo', client_email: 'test@example.com', private_key: 'unused' }, { fetchImpl });
  repository.token = 'test-token';
  repository.tokenExpiresAt = Date.now() + 3_600_000;
  const service = new TaskService(repository);
  const updated = await service.update(id, { title: ' Updated ', dueDate: '2026-09-21', owner: 'partner', priority: 'medium', completed: false });
  assert.equal(updated.completed, true);
  assert.equal(updated.createdAt, original.createdAt);
  assert.deepEqual(request.url.searchParams.getAll('updateMask.fieldPaths'), ['title', 'dueDate', 'owner', 'priority']);
  assert.equal(request.url.searchParams.get('currentDocument.exists'), 'true');
  assert.deepEqual(JSON.parse(request.options.body).fields, {
    title: { stringValue: 'Updated' }, dueDate: { stringValue: '2026-09-21' },
    owner: { stringValue: 'partner' }, priority: { stringValue: 'medium' },
  });
  assert.throws(() => service.update(id, { title: '', dueDate: '2026-09-21', owner: 'you', priority: 'medium' }), { status: 400 });
});

test('HTTP task routes return repository data and validation errors', async () => {
  const tasks = new Map();
  const repository = {
    list: async () => [...tasks.values()],
    create: async task => { tasks.set(task.id, task); return task; },
    setCompletion: async (id, completed) => {
      const task = tasks.get(id);
      if (!task) return null;
      task.completed = completed;
      return task;
    },
    updateDetails: async (id, details) => {
      const task = tasks.get(id);
      if (!task) return null;
      Object.assign(task, details);
      return task;
    },
    delete: async id => tasks.delete(id),
  };
  const server = new PlannerServer(new TaskService(repository), { get: async () => ({ quote: 'Keep going.', author: 'Someone' }) }).listen(0);
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await (await fetch(`${base}/api/quote`)).json(), { quote: 'Keep going.', author: 'Someone' });
    const created = await fetch(`${base}/api/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Plan week', dueDate: '2026-09-21', owner: 'you', priority: 'high' }),
    });
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal((await (await fetch(`${base}/api/tasks`)).json())[0].id, task.id);
    const edited = await fetch(`${base}/api/tasks/${task.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated plan', dueDate: '2026-09-22', owner: 'partner', priority: 'low' }),
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).title, 'Updated plan');
    assert.equal((await (await fetch(`${base}/api/tasks`)).json())[0].owner, 'partner');
    const updated = await fetch(`${base}/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: true }),
    });
    assert.equal((await updated.json()).completed, true);
    assert.equal((await fetch(`${base}/api/tasks/${task.id}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/tasks`)).json(), []);
    assert.equal((await fetch(`${base}/api/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ title: 'Missing', dueDate: '2026-09-22', owner: 'you', priority: 'low' }) })).status, 404);
    assert.equal((await fetch(`${base}/api/tasks`, { method: 'POST', body: 'null' })).status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
