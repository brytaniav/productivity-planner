const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const PUBLIC = path.join(__dirname, 'public');
let queue = Promise.resolve();

async function readTasks() {
  try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function mutate(fn) {
  const operation = queue.then(async () => {
    const tasks = await readTasks();
    const result = fn(tasks);
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(tasks, null, 2));
    await fs.rename(temp, DATA_FILE);
    return result;
  });
  queue = operation.catch(() => {});
  return operation;
}
function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 12000) throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  try { return JSON.parse(text || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/tasks') {
      if (req.method === 'GET') return respond(res, 200, await readTasks());
      if (req.method === 'POST') {
        const input = await body(req);
        const title = String(input.title || '').trim();
        if (!title || title.length > 120 || !validDate(input.dueDate) || !['you', 'partner'].includes(input.owner) || !['low', 'medium', 'high'].includes(input.priority)) return respond(res, 400, { error: 'Add a title, valid date, person, and priority.' });
        const task = { id: crypto.randomUUID(), title, dueDate: input.dueDate, owner: input.owner, priority: input.priority, completed: false, completedAt: null, createdAt: new Date().toISOString() };
        await mutate(tasks => tasks.push(task));
        return respond(res, 201, task);
      }
    }
    const match = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)$/);
    if (match && req.method === 'PATCH') {
      const input = await body(req);
      if (typeof input.completed !== 'boolean') return respond(res, 400, { error: 'Invalid completion state.' });
      const task = await mutate(tasks => {
        const found = tasks.find(item => item.id === match[1]);
        if (found) { found.completed = input.completed; found.completedAt = input.completed ? new Date().toISOString() : null; }
        return found;
      });
      return task ? respond(res, 200, task) : respond(res, 404, { error: 'Task not found.' });
    }
    if (match && req.method === 'DELETE') {
      const deleted = await mutate(tasks => {
        const index = tasks.findIndex(item => item.id === match[1]);
        if (index < 0) return false;
        tasks.splice(index, 1);
        return true;
      });
      return respond(res, deleted ? 200 : 404, { deleted });
    }
    if (url.pathname.startsWith('/api/')) return respond(res, 404, { error: 'Not found.' });
    if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.js', 'styles.css', 'house.svg', 'charlie-snoopy-reference.png', 'friends-reference.png'].includes(file)) return respond(res, 404, { error: 'Not found.' });
    const content = await fs.readFile(path.join(PUBLIC, file));
    res.writeHead(200, { 'Content-Type': `${mime[path.extname(file)]}; charset=utf-8` });
    res.end(content);
  } catch (error) {
    respond(res, error.status || 500, { error: error.status ? error.message : 'Server error.' });
    if (!error.status) console.error(error);
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Daydream Planner at http://localhost:${PORT}`));
