(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tracker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const owners = ['you', 'partner'];
  function dayKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function buildStats(tasks, today = new Date()) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
      return { key: dayKey(date), label: date.toLocaleDateString('en-US', { weekday: 'short' }), dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    });
    const people = Object.fromEntries(owners.map(owner => {
      const own = tasks.filter(task => task.owner === owner);
      const completed = own.filter(task => task.completed);
      const counts = days.map(day => completed.filter(task => task.completedAt && dayKey(new Date(task.completedAt)) === day.key).length);
      return [owner, {
        assigned: own.length,
        completed: completed.length,
        open: own.length - completed.length,
        rate: own.length ? Math.round(completed.length / own.length * 100) : 0,
        counts,
        weekCompleted: counts.reduce((sum, count) => sum + count, 0),
      }];
    }));
    return { days, people };
  }

  return { buildStats };
});
