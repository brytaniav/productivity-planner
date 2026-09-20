const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { FirestoreTaskRepository } = require('./public/backend/database/firestore-task-repository.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const STATIC_FILES = new Set(['index.html', 'app.js', 'daily-plan.js', 'tracker.js', 'styles.css', 'house.svg', 'charlie-snoopy-reference.png', 'friends-reference.png']);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
const QUOTE_URL = 'https://motivational-spark-api.vercel.app/api/quotes/2';

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
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

class TaskService {
  constructor(repository) { this.repository = repository; }

  list() { return this.repository.list(); }

  taskDetails(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw Object.assign(new Error('Invalid task.'), { status: 400 });
    }
    const title = String(input.title || '').trim();
    if (!title || title.length > 120 || !validDate(input.dueDate) || !['you', 'partner'].includes(input.owner) || !['low', 'medium', 'high'].includes(input.priority)) {
      throw Object.assign(new Error('Add a title, valid date, person, and priority.'), { status: 400 });
    }
    return { title, dueDate: input.dueDate, owner: input.owner, priority: input.priority };
  }

  create(input) {
    return this.repository.create({
      id: crypto.randomUUID(), ...this.taskDetails(input), completed: false, completedAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  update(id, input) { return this.repository.updateDetails(id, this.taskDetails(input)); }

  setCompletion(id, input) {
    if (!input || typeof input !== 'object' || typeof input.completed !== 'boolean') throw Object.assign(new Error('Invalid completion state.'), { status: 400 });
    return this.repository.setCompletion(id, input.completed);
  }

  delete(id) { return this.repository.delete(id); }
}

class QuoteService {
  constructor(fetchImpl = fetch) { this.fetch = fetchImpl; }

  async get() {
    const response = await this.fetch(QUOTE_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw Object.assign(new Error('Quote unavailable.'), { status: 502 });
    const data = await response.json();
    if (typeof data.quote !== 'string' || !data.quote.trim() || typeof data.author !== 'string' || !data.author.trim()) {
      throw Object.assign(new Error('Quote unavailable.'), { status: 502 });
    }
    return { quote: data.quote.trim(), author: data.author.trim() };
  }
}

class PlannerServer {
  constructor(taskService, quoteService = new QuoteService()) { this.tasks = taskService; this.quote = quoteService; }

  async handle(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/api/quote') {
        if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
        return respond(res, 200, await this.quote.get());
      }
      if (url.pathname === '/api/tasks') {
        if (req.method === 'GET') return respond(res, 200, await this.tasks.list());
        if (req.method === 'POST') return respond(res, 201, await this.tasks.create(await readBody(req)));
        return respond(res, 405, { error: 'Method not allowed.' });
      }
      const match = url.pathname.match(/^\/api\/tasks\/([a-f0-9-]+)$/);
      if (match) {
        if (req.method === 'PUT') {
          const task = await this.tasks.update(match[1], await readBody(req));
          return task ? respond(res, 200, task) : respond(res, 404, { error: 'Task not found.' });
        }
        if (req.method === 'PATCH') {
          const task = await this.tasks.setCompletion(match[1], await readBody(req));
          return task ? respond(res, 200, task) : respond(res, 404, { error: 'Task not found.' });
        }
        if (req.method === 'DELETE') {
          const deleted = await this.tasks.delete(match[1]);
          return respond(res, deleted ? 200 : 404, { deleted });
        }
        return respond(res, 405, { error: 'Method not allowed.' });
      }
      if (url.pathname.startsWith('/api/')) return respond(res, 404, { error: 'Not found.' });
      if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
      const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!STATIC_FILES.has(filename)) return respond(res, 404, { error: 'Not found.' });
      const content = await fs.readFile(path.join(PUBLIC, filename));
      res.writeHead(200, { 'Content-Type': `${MIME[path.extname(filename)]}; charset=utf-8` });
      res.end(content);
    } catch (error) {
      if (!error.status) console.error(error);
      respond(res, error.status || 500, { error: error.status ? error.message : 'Server error.' });
    }
  }

  listen(port = PORT) {
    return http.createServer(this.handle.bind(this)).listen(port, '0.0.0.0');
  }
}

async function main() {
  const repository = await FirestoreTaskRepository.fromEnvironment();
  const server = new PlannerServer(new TaskService(repository));
  server.listen();
  console.log(`Daydream Planner at http://localhost:${PORT}`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { TaskService, QuoteService, PlannerServer };
