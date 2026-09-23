(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DailyPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const owners = ['you', 'partner'];
  const priority = { high: 3, medium: 2, low: 1 };
  const dailyMix = { high: 2, medium: 2, low: 1 };
  const dailyLimit = Object.values(dailyMix).reduce((sum, count) => sum + count, 0);

  function localDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function byUrgency(a, b) {
    return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || a.dueDate.localeCompare(b.dueDate)
      || (priority[b.priority] || 0) - (priority[a.priority] || 0)
      || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      || String(a.id).localeCompare(String(b.id));
  }

  function twoDaysAfter(date) {
    const result = new Date(`${date}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + 2);
    return result.toISOString().slice(0, 10);
  }

  function buildDailyPlan(tasks, date) {
    const perPerson = {};
    const urgentUntil = twoDaysAfter(date);
    for (const owner of owners) {
      const own = tasks.filter(task => task.owner === owner);
      const completedToday = own.filter(task => task.completed && task.completedAt && localDate(task.completedAt) === date)
        .sort(byUrgency);
      const pending = own.filter(task => !task.completed).sort(byUrgency);
      const available = Math.max(0, dailyLimit - completedToday.length);
      const fixed = pending.filter(task => task.pinned || task.manualToday);
      const open = fixed.slice();
      const room = () => Math.max(available, fixed.length) - open.length;
      const selected = new Set(open.map(task => task.id));

      for (const task of pending.filter(task => task.dueDate <= urgentUntil && !selected.has(task.id)).slice(0, room())) {
        open.push(task);
        selected.add(task.id);
      }

      for (const level of ['high', 'medium', 'low']) {
        const used = [...open, ...completedToday].filter(task => task.priority === level).length;
        const needed = Math.min(dailyMix[level] - used, room());
        for (const task of pending.filter(task => task.priority === level && !selected.has(task.id)).slice(0, Math.max(0, needed))) {
          open.push(task);
          selected.add(task.id);
        }
      }
      for (const task of pending) {
        if (room() <= 0) break;
        if (!selected.has(task.id)) open.push(task);
      }
      open.sort(byUrgency);
      perPerson[owner] = { open, completedToday, tasks: [...open, ...completedToday] };
    }
    return perPerson;
  }

  return { buildDailyPlan };
});
