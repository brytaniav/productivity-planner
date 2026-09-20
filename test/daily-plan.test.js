const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDailyPlan } = require('../public/daily-plan.js');

function task(id, dueDate, owner = 'you', priority = 'medium', completed = false, completedAt = null) {
  return { id, dueDate, owner, priority, completed, completedAt, createdAt: `2026-09-01T00:00:0${id.length}Z` };
}

test('far deadlines fill free slots, then give way to urgent tasks', () => {
  const far = [task('a', '2026-11-01'), task('b', '2026-12-01'), task('c', '2027-01-01')];
  assert.deepEqual(buildDailyPlan(far, '2026-09-20').you.open.map(item => item.id), ['a', 'b', 'c']);
  const urgent = [task('d', '2026-09-20', 'you', 'low'), task('e', '2026-09-21'), task('f', '2026-09-21', 'you', 'high')];
  assert.deepEqual(buildDailyPlan([...far, ...urgent], '2026-09-20').you.open.map(item => item.id), ['d', 'f', 'e', 'a', 'b']);
});

test('daily mix targets two high, two medium, and one low task', () => {
  const tasks = [
    task('h1', '2026-10-01', 'you', 'high'), task('h2', '2026-10-02', 'you', 'high'), task('h3', '2026-10-03', 'you', 'high'),
    task('m1', '2026-10-04'), task('m2', '2026-10-05'), task('m3', '2026-10-06'),
    task('l1', '2026-10-07', 'you', 'low'), task('l2', '2026-10-08', 'you', 'low'),
  ];
  assert.deepEqual(buildDailyPlan(tasks, '2026-09-20').you.open.map(item => item.id), ['h1', 'h2', 'm1', 'm2', 'l1']);
});

test('near deadlines override the usual mix and empty categories do not waste slots', () => {
  const tasks = [
    task('h1', '2026-09-20', 'you', 'high'), task('h2', '2026-09-21', 'you', 'high'), task('h3', '2026-09-22', 'you', 'high'),
    task('m1', '2026-11-01'), task('m2', '2026-11-02'), task('l1', '2026-12-01', 'you', 'low'),
  ];
  assert.deepEqual(buildDailyPlan(tasks, '2026-09-20').you.open.map(item => item.id), ['h1', 'h2', 'h3', 'm1', 'm2']);
  const onlyHigh = tasks.filter(item => item.priority === 'high');
  assert.equal(buildDailyPlan(onlyHigh, '2026-09-20').you.open.length, 3);
});

test('unfinished tasks remain in the next day selection without changing their deadline', () => {
  const tasks = [task('a', '2026-09-20'), task('b', '2026-10-10')];
  assert.deepEqual(buildDailyPlan(tasks, '2026-09-20').you.open.map(item => item.id), ['a', 'b']);
  assert.deepEqual(buildDailyPlan(tasks, '2026-09-21').you.open.map(item => item.id), ['a', 'b']);
  assert.equal(tasks[0].dueDate, '2026-09-20');
});

test('today completions remain visible and use one daily slot per person', () => {
  const completedAt = new Date(2026, 8, 20, 12).toISOString();
  const tasks = [task('a', '2026-09-24', 'you', 'medium', true, completedAt), task('b', '2026-09-21'), task('c', '2026-09-22'), task('d', '2026-09-23'), task('e', '2026-09-20', 'partner')];
  const plan = buildDailyPlan(tasks, '2026-09-20');
  assert.deepEqual(plan.you.tasks.map(item => item.id), ['b', 'c', 'd', 'a']);
  assert.deepEqual(plan.partner.tasks.map(item => item.id), ['e']);
  assert.deepEqual(buildDailyPlan(tasks, '2026-09-21').you.tasks.map(item => item.id), ['b', 'c', 'd']);
});
