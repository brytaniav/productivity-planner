const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStats } = require('../public/tracker.js');

const stamp = (day) => new Date(2026, 8, day, 12).toISOString();

test('tracker compares seven local days and overall completion rates', () => {
  const tasks = [
    { owner: 'you', completed: true, completedAt: stamp(20) },
    { owner: 'you', completed: true, completedAt: stamp(19) },
    { owner: 'you', completed: false, completedAt: null },
    { owner: 'partner', completed: true, completedAt: stamp(14) },
    { owner: 'partner', completed: true, completedAt: stamp(13) },
    { owner: 'partner', completed: false, completedAt: null },
  ];
  const stats = buildStats(tasks, new Date(2026, 8, 20, 12));
  assert.equal(stats.days[0].key, '2026-09-14');
  assert.equal(stats.days[6].key, '2026-09-20');
  assert.deepEqual(stats.people.you.counts, [0, 0, 0, 0, 0, 1, 1]);
  assert.deepEqual(stats.people.partner.counts, [1, 0, 0, 0, 0, 0, 0]);
  assert.equal(stats.people.you.rate, 67);
  assert.equal(stats.people.partner.rate, 67);
  assert.equal(stats.people.you.weekCompleted, 2);
  assert.equal(stats.people.partner.weekCompleted, 1);
});

test('tracker handles an empty task list', () => {
  const stats = buildStats([], new Date(2026, 8, 20, 12));
  assert.equal(stats.people.you.rate, 0);
  assert.equal(stats.people.partner.weekCompleted, 0);
  assert.equal(stats.days.length, 7);
});
