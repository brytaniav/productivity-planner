const state = { tasks: [], schedules: [], view: 'today', filter: 'all', editingTaskId: null, editingScheduleId: null, month: new Date(), selected: localDate(new Date()), scheduleView: 'month', scheduleAnchor: new Date() };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const priorityScore = { high: 3, medium: 2, low: 1 };
const personName = { you: 'Snoopy', partner: 'Charlie Brown' };
const personImage = { you: '/charlie-snoopy-reference.png', partner: '/charlie-snoopy-reference.png' };

function localDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDate(value, options = { month: 'short', day: 'numeric' }) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', options); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
class TaskApi {
  async request(url, options = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`The task API returned an invalid response (${res.status}).`); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  list() { return this.request('/api/tasks'); }
  create(values) { return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(values) }); }
  update(id, values) { return this.request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(values) }); }
  setCompletion(id, completed) { return this.request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) }); }
  delete(id) { return this.request(`/api/tasks/${id}`, { method: 'DELETE' }); }
}

const taskApi = new TaskApi();
const scheduleApi = {
  request: (url, options = {}) => taskApi.request(url, options),
  list() { return this.request('/api/schedules'); },
  create(values) { return this.request('/api/schedules', { method: 'POST', body: JSON.stringify(values) }); },
  update(id, values) { return this.request(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(values) }); },
  delete(id) { return this.request(`/api/schedules/${id}`, { method: 'DELETE' }); },
};
async function loadQuote() {
  try {
    const response = await fetch('/api/quote');
    if (!response.ok) return;
    const { quote, author } = await response.json();
    if (typeof quote !== 'string' || typeof author !== 'string') return;
    $('.quote-card p').textContent = quote;
    $('.quote-footer').textContent = `— ${author}`;
  } catch {
    // Keep the quote already in the page when the API is unavailable.
  }
}
async function refresh() { try { [state.tasks, state.schedules] = await Promise.all([taskApi.list(), scheduleApi.list()]); render(); } catch (error) { showError(error.message); } }
function showError(message) { $('#form-error').textContent = message; if (!$('#task-dialog').open) alert(message); }
function taskSort(a, b) { return Number(a.completed) - Number(b.completed) || priorityScore[b.priority] - priorityScore[a.priority] || a.dueDate.localeCompare(b.dueDate); }
function filtered(tasks) { return tasks.filter(task => state.filter === 'all' || task.owner === state.filter); }
function taskCard(task) {
  const today = localDate(new Date());
  const due = task.dueDate < today && !task.completed ? `Carried over · due ${formatDate(task.dueDate)}` : task.dueDate === today ? 'Today' : formatDate(task.dueDate);
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const subtaskDone = subtasks.filter(item => item.completed).length;
  const details = task.notes || subtasks.length ? `<div class="task-details">${task.notes ? `<p class="task-notes">${escapeHTML(task.notes)}</p>` : ''}${subtasks.length ? `<div class="subtask-list"><span class="subtask-progress">${subtaskDone}/${subtasks.length} checklist items</span>${subtasks.map(item => `<label class="subtask ${item.completed ? 'done' : ''}"><input type="checkbox" data-subtask="${task.id}" data-subtask-id="${item.id}" ${item.completed ? 'checked' : ''}><span>${escapeHTML(item.title)}</span></label>`).join('')}</div>` : ''}</div>` : '';
  return `<article class="task-card ${task.completed ? 'complete' : ''} ${task.priority}-task ${task.pinned ? 'pinned' : ''}"><button class="check-button" data-toggle="${task.id}" aria-label="${task.completed ? 'Mark incomplete' : 'Complete'} ${escapeHTML(task.title)}">${task.completed ? '✓' : ''}</button><div class="task-body"><div class="task-title">${task.pinned ? '<span class="pin-mark">●</span>' : ''}${escapeHTML(task.title)}</div><div class="task-meta"><span class="due-date">◷ ${due}</span><span class="meta-dot">·</span><span class="owner-label ${task.owner}"><span class="mini-avatar"><img src="${personImage[task.owner]}" alt=""></span>${personName[task.owner]}</span>${subtasks.length ? `<span class="meta-dot">·</span><span>${subtaskDone}/${subtasks.length} subtasks</span>` : ''}</div>${details}</div><span class="priority ${task.priority}"><span class="priority-dot"></span>${task.priority}</span><div class="task-actions"><button class="today-action ${task.manualToday ? 'active' : ''}" data-today="${task.id}" aria-label="${task.manualToday ? 'Remove from' : 'Add to'} Today" title="${task.manualToday ? 'Remove from Today' : 'Add to Today'}">☀</button><button class="pin-button ${task.pinned ? 'active' : ''}" data-pin="${task.id}" aria-label="${task.pinned ? 'Unpin' : 'Pin'} ${escapeHTML(task.title)}" title="${task.pinned ? 'Unpin' : 'Pin to Today'}">◆</button><button class="edit-button" data-edit="${task.id}" aria-label="Edit ${escapeHTML(task.title)}" title="Edit task">✎</button><button class="delete-button" data-delete="${task.id}" aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">×</button></div></article>`;
}

function taskValues(task, changes = {}) {
  return { title: task.title, dueDate: task.dueDate, owner: task.owner, priority: task.priority,
    notes: task.notes || '', subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    pinned: Boolean(task.pinned), manualToday: Boolean(task.manualToday), ...changes };
}
function renderList(selector, tasks, empty = 'A clear sky! Add your first task to get started.') { $(selector).innerHTML = tasks.length ? tasks.map(taskCard).join('') : `<div class="empty-state"><span>✳</span><h3>Nothing here yet</h3><p>${empty}</p></div>`; }
function renderFilteredList(selector, tasks, empty) {
  $(selector).classList.toggle('grouped', state.filter === 'all');
  if (state.filter !== 'all') {
    renderList(selector, tasks, empty);
    return;
  }

  $(selector).innerHTML = ['you', 'partner'].map(owner => {
    const ownerTasks = tasks.filter(task => task.owner === owner);
    const headingId = `${selector.slice(1)}-${owner}-heading`;
    return `<section class="task-group ${owner}" aria-labelledby="${headingId}">
      <div class="task-group-heading"><span class="task-group-avatar ${owner}"><img src="${personImage[owner]}" alt=""></span>
        <h3 id="${headingId}">${personName[owner]}'s tasks</h3><span class="task-group-count">${ownerTasks.length}</span></div>
      <div class="task-group-list">${ownerTasks.length ? ownerTasks.map(taskCard).join('') : `<p class="task-group-empty">No tasks for ${personName[owner]} yet.</p>`}</div>
    </section>`;
  }).join('');
}
function renderProgress(plan) {
  $('#today-view .insight-card > p').textContent = "From today's suggested list.";
  $('#progress-list').innerHTML = ['you', 'partner'].map(owner => {
    const own = plan[owner].tasks;
    const done = plan[owner].completedToday.length;
    const percentage = own.length ? Math.round(done / own.length * 100) : 0;
    return `<div class="progress-person"><div class="progress-heading"><span class="progress-avatar ${owner}"><img src="${personImage[owner]}" alt=""></span><strong>${personName[owner]}</strong><span>${done}/${own.length} done</span></div><div class="progress-track"><div class="progress-fill ${owner}" style="width:${percentage}%"></div></div></div>`;
  }).join('');
}
function scheduleEventCard(event, compact = false) {
  const owner = event.owner === 'both' ? 'both' : event.owner;
  const ownerLabel = event.owner === 'both' ? 'Both' : personName[event.owner];
  const repeatLabel = event.recurrence && event.recurrence !== 'none' ? ` · ↻ ${event.recurrence}` : '';
  return `<article class="schedule-event ${owner} ${compact ? 'compact' : ''}"><div class="schedule-time">${event.startTime}<span>${event.endTime}</span></div><div class="schedule-event-body"><strong>${escapeHTML(event.title)}</strong><span>${ownerLabel}${repeatLabel}${event.location ? ` · ${escapeHTML(event.location)}` : ''}</span>${!compact && event.notes ? `<p>${escapeHTML(event.notes)}</p>` : ''}</div>${!compact ? `<div class="schedule-actions"><button data-edit-schedule="${event.id}" aria-label="Edit schedule series">✎</button><button data-delete-schedule="${event.id}" aria-label="Delete schedule series">×</button></div>` : ''}</article>`;
}
function renderTodaySchedules() {
  let container = $('#daily-schedules');
  if (!container) {
    $('#today-list').insertAdjacentHTML('beforebegin', '<div id="daily-schedules" class="daily-schedules"></div>');
    container = $('#daily-schedules');
  }
  const now = new Date();
  container.innerHTML = ['you', 'partner'].map(owner => {
    const events = Schedule.remainingToday(state.schedules, owner, now);
    return `<section class="daily-schedule-person ${owner}"><div class="daily-schedule-heading"><span>${personName[owner]}'s schedule today</span><small>${events.length ? `${events.length} remaining` : 'All clear'}</small></div>${events.length ? events.map(event => scheduleEventCard(event, true)).join('') : '<p>No more meetings or events today.</p>'}</section>`;
  }).join('');
}
function renderSchedule() {
  const dates = Schedule.rangeFor(state.scheduleView, state.scheduleAnchor);
  const eventMap = new Map(dates.map(date => [Schedule.dateKey(date), []]));
  Schedule.occurrences(state.schedules, dates).forEach(event => eventMap.get(event.date).push(event));
  eventMap.forEach(events => events.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  const anchor = state.scheduleAnchor;
  $('#schedule-range-label').textContent = state.scheduleView === 'month' ? anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : state.scheduleView === 'week' ? `${dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const weekdayHeader = state.scheduleView === 'month' ? '<div class="schedule-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>' : '';
  const cells = dates.map(date => {
    const key = Schedule.dateKey(date), events = eventMap.get(key);
    const outside = state.scheduleView === 'month' && date.getMonth() !== anchor.getMonth();
    return `<section class="schedule-day ${outside ? 'outside' : ''} ${key === localDate(new Date()) ? 'is-today' : ''}"><header><span>${state.scheduleView === 'month' ? date.getDate() : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span><button data-add-on-date="${key}" aria-label="Add schedule on ${key}">＋</button></header><div class="schedule-day-events">${events.length ? events.map(event => scheduleEventCard(event, state.scheduleView === 'month')).join('') : '<p class="schedule-empty-day">No events</p>'}</div></section>`;
  }).join('');
  $('#schedule-grid').className = `schedule-grid ${state.scheduleView}`;
  $('#schedule-grid').innerHTML = weekdayHeader + `<div class="schedule-days">${cells}</div>`;
}
function renderCalendar() {
  const year = state.month.getFullYear(), month = state.month.getMonth();
  $('#month-label').textContent = state.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  let html = Array(first).fill('<div class="calendar-cell outside"></div>').join('');
  for (let day = 1; day <= days; day++) {
    const key = localDate(new Date(year, month, day));
    const tasks = state.tasks.filter(task => task.dueDate === key);
    html += `<button class="calendar-cell ${key === localDate(new Date()) ? 'is-today' : ''} ${key === state.selected ? 'is-selected' : ''}" data-date="${key}"><span class="day-number">${day}</span><span class="calendar-items">${tasks.slice(0, 2).map(task => `<span class="calendar-task ${task.owner} ${task.completed ? 'done' : ''}" title="${escapeHTML(task.title)}">${escapeHTML(task.title)}</span>`).join('')}</span>${tasks.length > 2 ? `<small>+${tasks.length - 2} more</small>` : ''}</button>`;
  }
  $('#calendar-grid').innerHTML = html;
  $('#selected-date-label').textContent = `Due ${formatDate(state.selected, { weekday: 'long', month: 'long', day: 'numeric' })}`;
  renderList('#selected-date-tasks', state.tasks.filter(task => task.dueDate === state.selected).sort(taskSort), 'No tasks due on this day.');
}
function renderTracker() {
  const stats = Tracker.buildStats(state.tasks);
  $('#tracker-summary').innerHTML = ['you', 'partner'].map(owner => {
    const person = stats.people[owner];
    return `<article class="tracker-person ${owner}"><div class="tracker-person-heading"><span class="tracker-portrait ${owner}"><img src="${personImage[owner]}" alt=""></span><div><span class="kicker">PERSONAL PROGRESS</span><h3>${personName[owner]}</h3></div></div><div class="tracker-stats"><div><strong>${person.weekCompleted}</strong><span>done this week</span></div><div><strong>${person.assigned ? `${person.rate}%` : '—'}</strong><span>overall completion</span></div><div><strong>${person.open}</strong><span>still open</span></div></div><div class="tracker-rate-track" aria-label="${personName[owner]} completed ${person.completed} of ${person.assigned} assigned tasks"><div style="width:${person.rate}%"></div></div><p>${person.completed} of ${person.assigned} assigned tasks completed</p></article>`;
  }).join('');
  const max = Math.max(1, ...stats.people.you.counts, ...stats.people.partner.counts);
  const chart = stats.days.map((day, index) => `<div class="tracker-day"><div class="tracker-bars">${['you', 'partner'].map(owner => {
    const count = stats.people[owner].counts[index];
    return `<div class="tracker-bar-slot" title="${personName[owner]}: ${count} completed on ${day.dateLabel}"><span class="tracker-count">${count || ''}</span><div class="tracker-bar ${owner}" style="height:${count ? Math.max(8, Math.round(count / max * 100)) : 0}%"></div></div>`;
  }).join('')}</div><span class="tracker-day-label">${day.label}<small>${day.dateLabel}</small></span></div>`).join('');
  $('#tracker-chart').innerHTML = `<div class="tracker-plot" role="img" aria-label="Seven day comparison: Snoopy completed ${stats.people.you.weekCompleted} tasks, Charlie Brown completed ${stats.people.partner.weekCompleted} tasks">${chart}</div>${stats.people.you.weekCompleted + stats.people.partner.weekCompleted === 0 ? '<p class="tracker-empty">No completed tasks in the last seven days yet. Your first checkmark will appear here.</p>' : ''}`;
}
function render() {
  const today = localDate(new Date());
  const plan = DailyPlan.buildDailyPlan(state.tasks, today);
  const daily = filtered(['you', 'partner'].flatMap(owner => plan[owner].tasks));
  if (!$('#daily-explainer')) $('#today-list').insertAdjacentHTML('beforebegin', '<p id="daily-explainer" class="daily-explainer">Up to 5 per person: 2 high, 2 medium, 1 low. Tasks due soon take priority; unfinished tasks carry over tomorrow.</p>');
  renderFilteredList('#today-list', daily, 'Your daily lineup is clear. Add a task or enjoy the moment.');
  renderFilteredList('#all-list', filtered([...state.tasks]).sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate) || priorityScore[b.priority] - priorityScore[a.priority]));
  renderProgress(plan); renderTodaySchedules(); renderCalendar(); renderTracker(); renderSchedule();
  $('#today-label').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function setView(view) {
  if (!['today', 'schedule', 'calendar', 'all', 'tracker'].includes(view)) view = 'today';
  state.view = view;
  $$('.view').forEach(el => el.classList.toggle('hidden', el.id !== `${view}-view`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const copy = { today: ['Today', 'Make today count', "Good things happen one task at a time. Let's get going!"], schedule: ['Schedule', 'Make time for what matters', 'Meetings, classes, and plans for both of you.'], calendar: ['Calendar', 'A little look ahead', 'All your important dates, together in one place.'], all: ['All tasks', 'Every little thing', 'A cozy home for every plan, big or small.'], tracker: ['Tracker', 'Celebrate your progress', 'A little look at what you have accomplished together.'] }[view];
  $('#breadcrumb').textContent = copy[0]; $('#page-title').innerHTML = `${copy[1]}<span class="period">.</span>`; $('#page-subtitle').textContent = copy[2];
  location.hash = view;
}

function openTaskDialog(task = null) {
  const form = $('#task-form');
  form.reset();
  state.editingTaskId = task?.id || null;
  $('#form-error').textContent = '';
  $('#task-dialog .kicker').textContent = task ? 'MAKE A LITTLE CHANGE' : 'A NEW LITTLE PLAN';
  $('#task-dialog h2').innerHTML = `${task ? 'Edit' : 'Add'} a task<span class="period">.</span>`;
  $('#task-dialog .submit-button').textContent = task ? 'Save changes' : 'Add to our planner →';
  form.elements.title.value = task?.title || '';
  form.elements.dueDate.value = task?.dueDate || localDate(new Date());
  form.elements.notes.value = task?.notes || '';
  form.elements.checklist.value = (task?.subtasks || []).map(item => item.title).join('\n');
  if (task) {
    form.elements.priority.value = task.priority;
    form.elements.owner.value = task.owner;
  }
  $('#task-dialog').showModal();
}

function openScheduleDialog(event = null, date = localDate(new Date())) {
  const form = $('#schedule-form');
  form.reset();
  state.editingScheduleId = event?.id || null;
  $('#schedule-error').textContent = '';
  $('#schedule-dialog h2').innerHTML = `${event ? 'Edit' : 'Add'} schedule<span class="period">.</span>`;
  $('#schedule-dialog .submit-button').textContent = event ? 'Save changes' : 'Save schedule →';
  form.elements.title.value = event?.title || '';
  form.elements.date.value = event?.date || date;
  form.elements.startTime.value = event?.startTime || '09:00';
  form.elements.endTime.value = event?.endTime || '10:00';
  form.elements.owner.value = event?.owner || 'you';
  form.elements.recurrence.value = event?.recurrence || 'none';
  form.elements.repeatEndDate.value = event?.repeatEndDate || '';
  form.elements.location.value = event?.location || '';
  form.elements.notes.value = event?.notes || '';
  updateRecurrenceFields();
  $('#schedule-dialog').showModal();
}

function updateRecurrenceFields() {
  const form = $('#schedule-form');
  const repeating = form.elements.recurrence.value !== 'none';
  $('#repeat-end-label').classList.toggle('hidden-field', !repeating);
  form.elements.repeatEndDate.required = repeating;
  form.elements.repeatEndDate.min = form.elements.date.value;
  if (!repeating) form.elements.repeatEndDate.value = '';
  if (repeating && !form.elements.repeatEndDate.value) form.elements.repeatEndDate.value = form.elements.date.value;
  const names = { daily: 'day', weekly: new Date(`${form.elements.date.value || localDate(new Date())}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }), monthly: `month on day ${Number((form.elements.date.value || '').slice(-2)) || 1}` };
  $('#repeat-summary').textContent = repeating ? `Repeats every ${names[form.elements.recurrence.value]} through the selected end date.` : '';
}

document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-view]'); if (nav) setView(nav.dataset.view);
  const filter = event.target.closest('[data-filter]'); if (filter) { state.filter = filter.dataset.filter; $$('[data-filter]').forEach(el => el.classList.toggle('selected', el.dataset.filter === state.filter)); render(); }
  const toggle = event.target.closest('[data-toggle]'); if (toggle) { const task = state.tasks.find(item => item.id === toggle.dataset.toggle); if (task) { try { await taskApi.setCompletion(task.id, !task.completed); await refresh(); } catch (error) { showError(error.message); } } }
  const subtask = event.target.closest('[data-subtask]'); if (subtask) { const task = state.tasks.find(item => item.id === subtask.dataset.subtask); if (task) { const subtasks = (task.subtasks || []).map(item => item.id === subtask.dataset.subtaskId ? { ...item, completed: subtask.checked } : item); try { await taskApi.update(task.id, taskValues(task, { subtasks })); await refresh(); } catch (error) { showError(error.message); } } }
  const todayAction = event.target.closest('[data-today]'); if (todayAction) { const task = state.tasks.find(item => item.id === todayAction.dataset.today); if (task) { try { await taskApi.update(task.id, taskValues(task, { manualToday: !task.manualToday })); await refresh(); } catch (error) { showError(error.message); } } }
  const pin = event.target.closest('[data-pin]'); if (pin) { const task = state.tasks.find(item => item.id === pin.dataset.pin); if (task) { try { await taskApi.update(task.id, taskValues(task, { pinned: !task.pinned, manualToday: task.pinned ? task.manualToday : true })); await refresh(); } catch (error) { showError(error.message); } } }
  const edit = event.target.closest('[data-edit]'); if (edit) { const task = state.tasks.find(item => item.id === edit.dataset.edit); if (task) openTaskDialog(task); }
  const del = event.target.closest('[data-delete]'); if (del && confirm('Delete this task?')) { try { await taskApi.delete(del.dataset.delete); await refresh(); } catch (error) { showError(error.message); } }
  const day = event.target.closest('[data-date]'); if (day) { state.selected = day.dataset.date; renderCalendar(); }
  const addOnDate = event.target.closest('[data-add-on-date]'); if (addOnDate) openScheduleDialog(null, addOnDate.dataset.addOnDate);
  const editSchedule = event.target.closest('[data-edit-schedule]'); if (editSchedule) { const item = state.schedules.find(schedule => schedule.id === editSchedule.dataset.editSchedule); if (item) openScheduleDialog(item); }
  const deleteSchedule = event.target.closest('[data-delete-schedule]'); if (deleteSchedule && confirm('Delete this schedule item?')) { try { await scheduleApi.delete(deleteSchedule.dataset.deleteSchedule); await refresh(); } catch (error) { alert(error.message); } }
});
$$('.add-button').forEach(button => button.addEventListener('click', () => openTaskDialog()));
$('#close-dialog').addEventListener('click', () => $('#task-dialog').close());
$('#task-dialog').addEventListener('click', event => { if (event.target.id === 'task-dialog') $('#task-dialog').close(); });
$('#task-dialog').addEventListener('close', () => { state.editingTaskId = null; });
$('#task-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const existing = state.tasks.find(task => task.id === state.editingTaskId);
  const previous = new Map((existing?.subtasks || []).map(item => [item.title.toLowerCase(), item]));
  values.subtasks = String(values.checklist || '').split('\n').map(title => title.trim()).filter(Boolean).slice(0, 30).map(title => {
    const saved = previous.get(title.toLowerCase());
    return { id: saved?.id || crypto.randomUUID(), title, completed: Boolean(saved?.completed) };
  });
  delete values.checklist;
  values.pinned = Boolean(existing?.pinned);
  values.manualToday = Boolean(existing?.manualToday);
  try { if (state.editingTaskId) await taskApi.update(state.editingTaskId, values); else await taskApi.create(values); $('#task-dialog').close(); await refresh(); }
  catch (error) { $('#form-error').textContent = error.message; }
});
$('#add-schedule').addEventListener('click', () => openScheduleDialog());
$('#close-schedule').addEventListener('click', () => $('#schedule-dialog').close());
$('#schedule-dialog').addEventListener('click', event => { if (event.target.id === 'schedule-dialog') $('#schedule-dialog').close(); });
$('#schedule-dialog').addEventListener('close', () => { state.editingScheduleId = null; });
$('#schedule-form').elements.recurrence.addEventListener('change', updateRecurrenceFields);
$('#schedule-form').elements.date.addEventListener('change', updateRecurrenceFields);
$('#schedule-form').addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try { if (state.editingScheduleId) await scheduleApi.update(state.editingScheduleId, values); else await scheduleApi.create(values); $('#schedule-dialog').close(); await refresh(); }
  catch (error) { $('#schedule-error').textContent = error.message; }
});
$$('[data-schedule-view]').forEach(button => button.addEventListener('click', () => { state.scheduleView = button.dataset.scheduleView; $$('[data-schedule-view]').forEach(item => item.classList.toggle('selected', item === button)); renderSchedule(); }));
$('#schedule-today').addEventListener('click', () => { state.scheduleAnchor = new Date(); renderSchedule(); });
$('#schedule-prev').addEventListener('click', () => { const date = new Date(state.scheduleAnchor); if (state.scheduleView === 'month') date.setMonth(date.getMonth() - 1); else date.setDate(date.getDate() - (state.scheduleView === 'week' ? 7 : 1)); state.scheduleAnchor = date; renderSchedule(); });
$('#schedule-next').addEventListener('click', () => { const date = new Date(state.scheduleAnchor); if (state.scheduleView === 'month') date.setMonth(date.getMonth() + 1); else date.setDate(date.getDate() + (state.scheduleView === 'week' ? 7 : 1)); state.scheduleAnchor = date; renderSchedule(); });
$('#prev-month').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); });
$('#next-month').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); });
$('#today-label').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('daydream-theme', theme);
  $('#theme-toggle').textContent = theme === 'dark' ? '☀' : '☾';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}
$('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
setTheme(localStorage.getItem('daydream-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
setView(location.hash.slice(1) || 'today');
refresh();
loadQuote();
setInterval(refresh, 15000);
setInterval(() => { if (state.view === 'today') renderTodaySchedules(); }, 60000);
