const { FirestoreTaskRepository } = require('./firestore-task-repository.js');

const FIELDS = ['title', 'date', 'startTime', 'endTime', 'owner', 'location', 'notes', 'recurrence', 'repeatEndDate', 'createdAt'];

class FirestoreScheduleRepository extends FirestoreTaskRepository {
  constructor(credentials, options = {}) {
    super(credentials, options);
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/databases/${encodeURIComponent(this.databaseId)}/documents/schedules`;
  }

  static async fromEnvironment(options = {}) {
    const taskRepository = await FirestoreTaskRepository.fromEnvironment(options);
    return new FirestoreScheduleRepository(taskRepository.credentials, { databaseId: taskRepository.databaseId, fetchImpl: options.fetchImpl || fetch });
  }

  static encodeEvent(event) {
    return { fields: Object.fromEntries(FIELDS.map(field => [field, { stringValue: String(event[field] || '') }])) };
  }

  static decodeEvent(document) {
    const event = { id: document.name.split('/').pop(), ...Object.fromEntries(FIELDS.map(field => [field, document.fields?.[field]?.stringValue || ''])) };
    event.recurrence ||= 'none';
    return event;
  }

  async list() {
    const events = [];
    let pageToken;
    do {
      const url = new URL(this.baseUrl);
      url.searchParams.set('pageSize', '300');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const page = await this.request(url);
      events.push(...(page?.documents || []).map(FirestoreScheduleRepository.decodeEvent));
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return events;
  }

  async create(event) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('documentId', event.id);
    return FirestoreScheduleRepository.decodeEvent(await this.request(url, { method: 'POST', body: JSON.stringify(FirestoreScheduleRepository.encodeEvent(event)) }));
  }

  async update(id, event) {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(id)}`);
    FIELDS.filter(field => field !== 'createdAt').forEach(field => url.searchParams.append('updateMask.fieldPaths', field));
    url.searchParams.set('currentDocument.exists', 'true');
    const document = await this.request(url, { method: 'PATCH', body: JSON.stringify(FirestoreScheduleRepository.encodeEvent(event)) }, { allowMissing: true });
    return document && FirestoreScheduleRepository.decodeEvent(document);
  }

  async delete(id) {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(id)}`);
    url.searchParams.set('currentDocument.exists', 'true');
    return (await this.request(url, { method: 'DELETE' }, { allowMissing: true })) !== null;
  }
}

module.exports = { FirestoreScheduleRepository };
