const state = { tasks: [], view: 'today', filter: 'all', editingTaskId: null, month: new Date(), selected: localDate(new Date()) };
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
    const data = await res.json();
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
async function refresh() { try { state.tasks = await taskApi.list(); render(); } catch (error) { showError(error.message); } }
function showError(message) { $('#form-error').textContent = message; if (!$('#task-dialog').open) alert(message); }
function taskSort(a, b) { return Number(a.completed) - Number(b.completed) || priorityScore[b.priority] - priorityScore[a.priority] || a.dueDate.localeCompare(b.dueDate); }
function filtered(tasks) { return tasks.filter(task => state.filter === 'all' || task.owner === state.filter); }
function taskCard(task) {
  const today = localDate(new Date());
  const due = task.dueDate < today && !task.completed ? 'Overdue' : task.dueDate === today ? 'Today' : formatDate(task.dueDate);
  return `<article class="task-card ${task.completed ? 'complete' : ''} ${task.priority}-task"><button class="check-button" data-toggle="${task.id}" aria-label="${task.completed ? 'Mark incomplete' : 'Complete'} ${escapeHTML(task.title)}">${task.completed ? '✓' : ''}</button><div class="task-body"><div class="task-title">${escapeHTML(task.title)}</div><div class="task-meta"><span class="due-date">◷ ${due}</span><span class="meta-dot">·</span><span class="owner-label ${task.owner}"><span class="mini-avatar"><img src="${personImage[task.owner]}" alt=""></span>${personName[task.owner]}</span></div></div><span class="priority ${task.priority}"><span class="priority-dot"></span>${task.priority}</span><button class="edit-button" data-edit="${task.id}" aria-label="Edit ${escapeHTML(task.title)}" title="Edit task">✎</button><button class="delete-button" data-delete="${task.id}" aria-label="Delete ${escapeHTML(task.title)}" title="Delete task">×</button></article>`;
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
function renderProgress() {
  $('#progress-list').innerHTML = ['you', 'partner'].map(owner => {
    const own = state.tasks.filter(task => task.owner === owner);
    const done = own.filter(task => task.completed).length;
    const percentage = own.length ? Math.round(done / own.length * 100) : 0;
    return `<div class="progress-person"><div class="progress-heading"><span class="progress-avatar ${owner}"><img src="${personImage[owner]}" alt=""></span><strong>${personName[owner]}</strong><span>${done}/${own.length} done</span></div><div class="progress-track"><div class="progress-fill ${owner}" style="width:${percentage}%"></div></div></div>`;
  }).join('');
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
function render() {
  const daily = filtered([...state.tasks]).sort(taskSort);
  renderFilteredList('#today-list', daily, 'Your daily lineup is clear. Add a task or enjoy the moment.');
  renderFilteredList('#all-list', filtered([...state.tasks]).sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate) || priorityScore[b.priority] - priorityScore[a.priority]));
  renderProgress(); renderCalendar();
}
function setView(view) {
  if (!['today', 'calendar', 'all'].includes(view)) view = 'today';
  state.view = view;
  $$('.view').forEach(el => el.classList.toggle('hidden', el.id !== `${view}-view`));
  $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const copy = { today: ['Today', 'Make today count', "Good things happen one task at a time. Let's get going!"], calendar: ['Calendar', 'A little look ahead', 'All your important dates, together in one place.'], all: ['All tasks', 'Every little thing', 'A cozy home for every plan, big or small.'] }[view];
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
  if (task) {
    form.elements.priority.value = task.priority;
    form.elements.owner.value = task.owner;
  }
  $('#task-dialog').showModal();
}

document.addEventListener('click', async event => {
  const nav = event.target.closest('[data-view]'); if (nav) setView(nav.dataset.view);
  const filter = event.target.closest('[data-filter]'); if (filter) { state.filter = filter.dataset.filter; $$('[data-filter]').forEach(el => el.classList.toggle('selected', el.dataset.filter === state.filter)); render(); }
  const toggle = event.target.closest('[data-toggle]'); if (toggle) { const task = state.tasks.find(item => item.id === toggle.dataset.toggle); if (task) { try { await taskApi.setCompletion(task.id, !task.completed); await refresh(); } catch (error) { showError(error.message); } } }
  const edit = event.target.closest('[data-edit]'); if (edit) { const task = state.tasks.find(item => item.id === edit.dataset.edit); if (task) openTaskDialog(task); }
  const del = event.target.closest('[data-delete]'); if (del && confirm('Delete this task?')) { try { await taskApi.delete(del.dataset.delete); await refresh(); } catch (error) { showError(error.message); } }
  const day = event.target.closest('[data-date]'); if (day) { state.selected = day.dataset.date; renderCalendar(); }
});
$$('.add-button').forEach(button => button.addEventListener('click', () => openTaskDialog()));
$('#close-dialog').addEventListener('click', () => $('#task-dialog').close());
$('#task-dialog').addEventListener('click', event => { if (event.target.id === 'task-dialog') $('#task-dialog').close(); });
$('#task-dialog').addEventListener('close', () => { state.editingTaskId = null; });
$('#task-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  try { if (state.editingTaskId) await taskApi.update(state.editingTaskId, values); else await taskApi.create(values); $('#task-dialog').close(); await refresh(); }
  catch (error) { $('#form-error').textContent = error.message; }
});
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
setInterval(refresh, 15000);
