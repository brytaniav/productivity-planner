const test = require('node:test');
const assert = require('node:assert/strict');
const { remainingToday, rangeFor, occurrences } = require('../public/schedule.js');
const { ScheduleService } = require('../server.js');

test('Today schedule includes shared events and removes events after their end time', () => {
  const events = [
    { id: 'past', date: '2026-10-11', startTime: '08:00', endTime: '09:00', owner: 'you' },
    { id: 'snoopy', date: '2026-10-11', startTime: '11:00', endTime: '12:00', owner: 'you' },
    { id: 'both', date: '2026-10-11', startTime: '10:30', endTime: '11:30', owner: 'both' },
    { id: 'charlie', date: '2026-10-11', startTime: '13:00', endTime: '14:00', owner: 'partner' },
  ];
  const now = new Date(2026, 9, 11, 10, 0);
  assert.deepEqual(remainingToday(events, 'you', now).map(event => event.id), ['both', 'snoopy']);
  assert.deepEqual(remainingToday(events, 'partner', now).map(event => event.id), ['both', 'charlie']);
});

test('schedule ranges support month, week, and day views', () => {
  const anchor = new Date(2026, 9, 14);
  assert.equal(rangeFor('month', anchor).length, 42);
  assert.equal(rangeFor('week', anchor).length, 7);
  assert.equal(rangeFor('day', anchor).length, 1);
  assert.equal(rangeFor('week', anchor)[0].getDay(), 0);
});

test('weekly schedules repeat on the start weekday through the inclusive end date', () => {
  const series = [{ id: 'class', title: 'Class', date: '2026-10-05', startTime: '09:00', endTime: '10:00', owner: 'you', recurrence: 'weekly', repeatEndDate: '2026-10-26' }];
  const dates = Array.from({ length: 31 }, (_, index) => new Date(2026, 9, index + 1));
  assert.deepEqual(occurrences(series, dates).map(event => event.date), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
});

test('daily and monthly schedules stop at their end dates', () => {
  const dates = Array.from({ length: 42 }, (_, index) => new Date(2026, 9, index + 1));
  const daily = [{ id: 'daily', date: '2026-10-10', startTime: '09:00', endTime: '10:00', owner: 'you', recurrence: 'daily', repeatEndDate: '2026-10-12' }];
  const monthly = [{ id: 'monthly', date: '2026-10-11', startTime: '09:00', endTime: '10:00', owner: 'you', recurrence: 'monthly', repeatEndDate: '2026-11-11' }];
  assert.deepEqual(occurrences(daily, dates).map(event => event.date), ['2026-10-10', '2026-10-11', '2026-10-12']);
  assert.deepEqual(occurrences(monthly, dates).map(event => event.date), ['2026-10-11', '2026-11-11']);
});

test('schedule service validates the time range and creates an event', async () => {
  const repository = { create: async event => event };
  const service = new ScheduleService(repository);
  assert.throws(() => service.create({ title: 'Meeting', date: '2026-10-11', startTime: '11:00', endTime: '10:00', owner: 'both' }), { status: 400 });
  const event = await service.create({ title: ' Meeting ', date: '2026-10-11', startTime: '10:00', endTime: '11:00', owner: 'both', location: 'Room 2' });
  assert.equal(event.title, 'Meeting');
  assert.equal(event.owner, 'both');
  assert.match(event.id, /^[a-f0-9-]{36}$/);
  assert.throws(() => service.create({ title: 'Class', date: '2026-10-12', startTime: '10:00', endTime: '11:00', owner: 'you', recurrence: 'weekly', repeatEndDate: '2026-10-11' }), { status: 400 });
});
