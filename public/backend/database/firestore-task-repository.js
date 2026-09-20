const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const FIELDS = ['title', 'dueDate', 'owner', 'priority', 'completed', 'completedAt', 'createdAt'];

class FirestoreTaskRepository {
  constructor(credentials, { databaseId = 'tasks', fetchImpl = fetch } = {}) {
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new Error('The service account needs project_id, client_email, and private_key.');
    }
    this.credentials = credentials;
    this.databaseId = databaseId;
    this.fetch = fetchImpl;
    this.token = null;
    this.tokenExpiresAt = 0;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/databases/${encodeURIComponent(databaseId)}/documents/tasks`;
  }

  static async fromEnvironment(options = {}) {
    const filename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', '..', '..', 'secret', 'service_account.json');
    const credentials = JSON.parse(await fs.readFile(filename, 'utf8'));
    return new FirestoreTaskRepository(credentials, {
      databaseId: process.env.FIRESTORE_DATABASE_ID || 'tasks',
      ...options,
    });
  }

  async accessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const assertion = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(assertion), this.credentials.private_key).toString('base64url');
    const response = await this.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${assertion}.${signature}` }),
    });
    if (!response.ok) throw new Error(`Firestore authentication failed (${response.status}).`);
    const data = await response.json();
    if (!data.access_token || !Number.isFinite(Number(data.expires_in))) throw new Error('Firestore authentication returned an invalid token.');
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + Number(data.expires_in) * 1000;
    return this.token;
  }

  async request(url, options = {}, { allowMissing = false } = {}) {
    const response = await this.fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw new Error(`Firestore request failed (${response.status}).`);
    return response.status === 204 ? undefined : response.json();
  }

  static encodeTask(task) {
    const fields = {};
    for (const name of FIELDS) {
      const value = task[name];
      fields[name] = value === null ? { nullValue: null } : typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value };
    }
    return { fields };
  }

  static decodeTask(document) {
    const task = { id: document.name.split('/').pop() };
    for (const name of FIELDS) {
      const value = document.fields?.[name];
      task[name] = value?.stringValue ?? value?.booleanValue ?? null;
    }
    return task;
  }

  async list() {
    const tasks = [];
    let pageToken;
    do {
      const url = new URL(this.baseUrl);
      url.searchParams.set('pageSize', '300');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const page = await this.request(url);
      tasks.push(...(page?.documents || []).map(FirestoreTaskRepository.decodeTask));
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return tasks;
  }

  async create(task) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('documentId', task.id);
    const document = await this.request(url, { method: 'POST', body: JSON.stringify(FirestoreTaskRepository.encodeTask(task)) });
    return FirestoreTaskRepository.decodeTask(document);
  }

  async setCompletion(id, completed) {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(id)}`);
    url.searchParams.append('updateMask.fieldPaths', 'completed');
    url.searchParams.append('updateMask.fieldPaths', 'completedAt');
    url.searchParams.set('currentDocument.exists', 'true');
    const document = await this.request(url, {
      method: 'PATCH',
      body: JSON.stringify({ fields: {
        completed: { booleanValue: completed },
        completedAt: completed ? { stringValue: new Date().toISOString() } : { nullValue: null },
      } }),
    }, { allowMissing: true });
    return document && FirestoreTaskRepository.decodeTask(document);
  }

  async updateDetails(id, details) {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(id)}`);
    for (const field of ['title', 'dueDate', 'owner', 'priority']) {
      url.searchParams.append('updateMask.fieldPaths', field);
    }
    url.searchParams.set('currentDocument.exists', 'true');
    const document = await this.request(url, {
      method: 'PATCH',
      body: JSON.stringify({ fields: Object.fromEntries(
        Object.entries(details).map(([field, value]) => [field, { stringValue: value }]),
      ) }),
    }, { allowMissing: true });
    return document && FirestoreTaskRepository.decodeTask(document);
  }

  async delete(id) {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(id)}`);
    url.searchParams.set('currentDocument.exists', 'true');
    const response = await this.request(url, { method: 'DELETE' }, { allowMissing: true });
    return response !== null;
  }
}

module.exports = { FirestoreTaskRepository };
