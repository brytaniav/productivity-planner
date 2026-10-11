(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Schedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function eventEnd(event) { return new Date(`${event.date}T${event.endTime}:00`); }
  function belongsTo(event, owner) { return event.owner === owner || event.owner === 'both'; }
  function occursOn(event, key) {
    if (key < event.date) return false;
    const recurrence = event.recurrence || 'none';
    if (recurrence === 'none') return key === event.date;
    if (event.repeatEndDate && key > event.repeatEndDate) return false;
    const start = new Date(`${event.date}T12:00:00`), target = new Date(`${key}T12:00:00`);
    const days = Math.round((target - start) / 86400000);
    if (recurrence === 'daily') return true;
    if (recurrence === 'weekly') return days % 7 === 0;
    return recurrence === 'monthly' && target.getDate() === start.getDate();
  }
  function occurrences(events, dates) {
    return dates.flatMap(date => {
      const key = dateKey(date);
      return events.filter(event => occursOn(event, key)).map(event => ({ ...event, date: key, seriesDate: event.date, occurrence: key !== event.date }));
    });
  }
  function remainingToday(events, owner, now = new Date()) {
    const today = dateKey(now);
    return occurrences(events, [now]).filter(event => belongsTo(event, owner) && eventEnd(event) > now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  function rangeFor(view, anchor) {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    if (view === 'month') {
      start.setDate(1); start.setDate(start.getDate() - start.getDay());
      return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    if (view === 'week') start.setDate(start.getDate() - start.getDay());
    const count = view === 'week' ? 7 : 1;
    return Array.from({ length: count }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return { dateKey, belongsTo, occursOn, occurrences, remainingToday, rangeFor };
});
