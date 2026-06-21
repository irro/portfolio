/* NYC 8 Ball — admin dashboard logic */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const api = (path, opts) => fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }, opts));

  let activities = [];      // current order = custom order
  let sortBy = 'manual';
  let search = '';
  let filterActive = 'all';

  // ---- Auth ----
  async function checkSession() {
    const res = await api('/api/admin/session');
    const { authed } = await res.json();
    if (authed) showApp(); else showLogin();
  }

  function showLogin() { $('login').hidden = false; $('app').hidden = true; $('password').focus(); }
  function showApp() { $('login').hidden = true; $('app').hidden = false; load(); }

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginError').hidden = true;
    const res = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
    if (res.ok) { $('password').value = ''; showApp(); }
    else { $('loginError').textContent = 'Incorrect password.'; $('loginError').hidden = false; }
  });

  $('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  // ---- Load + render ----
  async function load() {
    const res = await api('/api/admin/activities');
    if (res.status === 401) return showLogin();
    activities = await res.json();
    refreshDatalists();
    render();
  }

  function refreshDatalists() {
    const cats = [...new Set(activities.map((a) => a.category).filter(Boolean))].sort();
    const boros = [...new Set(activities.map((a) => a.borough).filter(Boolean))].sort();
    $('categories').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
    $('boroughs').innerHTML = boros.map((b) => `<option value="${esc(b)}">`).join('');
  }

  function visibleRows() {
    let rows = activities.slice();
    if (filterActive === 'active') rows = rows.filter((a) => a.active);
    if (filterActive === 'inactive') rows = rows.filter((a) => !a.active);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((a) =>
        [a.title, a.category, a.borough, a.description, a.costNote].join(' ').toLowerCase().includes(q));
    }
    const by = sortBy;
    if (by === 'title') rows.sort((a, b) => a.title.localeCompare(b.title));
    else if (by === 'cost') rows.sort((a, b) => a.cost - b.cost);
    else if (by === 'cost-desc') rows.sort((a, b) => b.cost - a.cost);
    else if (by === 'category') rows.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
    else if (by === 'borough') rows.sort((a, b) => a.borough.localeCompare(b.borough) || a.title.localeCompare(b.title));
    // 'manual' keeps the server (custom) order
    return rows;
  }

  function render() {
    const rows = visibleRows();
    const manual = sortBy === 'manual' && !search && filterActive === 'all';
    $('reorderHint').style.opacity = manual ? '1' : '.4';

    const active = activities.filter((a) => a.active).length;
    $('counts').textContent = `${activities.length} total · ${active} active`;

    $('empty').hidden = rows.length > 0;
    $('rows').innerHTML = rows.map((a, i) => rowHtml(a, i, rows.length, manual)).join('');
    bindRowEvents();
  }

  function costCell(a) {
    if (!a.cost || a.cost <= 0) {
      return `<span class="cost free">Free${a.costNote ? `<small>${esc(a.costNote)}</small>` : ''}</span>`;
    }
    const n = Number.isInteger(a.cost) ? a.cost : a.cost.toFixed(2);
    return `<span class="cost">$${n}${a.costNote ? `<small>${esc(a.costNote)}</small>` : ''}</span>`;
  }

  function rowHtml(a, i, total, manual) {
    return `
      <tr class="${a.active ? '' : 'inactive'}" data-id="${a.id}">
        <td class="col-order">
          <div class="order-btns">
            <button class="iconbtn" data-act="up" ${manual && i > 0 ? '' : 'disabled'} title="Move up">↑</button>
            <button class="iconbtn" data-act="down" ${manual && i < total - 1 ? '' : 'disabled'} title="Move down">↓</button>
          </div>
        </td>
        <td class="cell-title">${esc(a.title)}<small>${esc(a.description || '')}</small></td>
        <td class="col-cat"><span class="tag">${esc(a.category)}</span></td>
        <td class="col-boro"><span class="tag">${esc(a.borough)}</span></td>
        <td class="col-cost">${costCell(a)}</td>
        <td class="col-active">
          <label class="switch"><input type="checkbox" data-act="toggle" ${a.active ? 'checked' : ''}><span class="slider"></span></label>
        </td>
        <td class="col-act">
          <div class="row-actions">
            <button class="btn tiny" data-act="edit">Edit</button>
            <button class="btn tiny danger" data-act="delete">Delete</button>
          </div>
        </td>
      </tr>`;
  }

  function bindRowEvents() {
    $('rows').querySelectorAll('tr').forEach((tr) => {
      const id = Number(tr.dataset.id);
      tr.querySelector('[data-act="toggle"]').addEventListener('change', (e) => toggleActive(id, e.target.checked));
      tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEdit(id));
      tr.querySelector('[data-act="delete"]').addEventListener('click', () => del(id));
      const up = tr.querySelector('[data-act="up"]');
      const down = tr.querySelector('[data-act="down"]');
      if (up && !up.disabled) up.addEventListener('click', () => move(id, -1));
      if (down && !down.disabled) down.addEventListener('click', () => move(id, +1));
    });
  }

  // ---- Mutations ----
  async function toggleActive(id, active) {
    await api('/api/admin/activities/' + id, { method: 'PATCH', body: JSON.stringify({ active }) });
    const a = activities.find((x) => x.id === id);
    if (a) a.active = active;
    render();
  }

  async function del(id) {
    const a = activities.find((x) => x.id === id);
    if (!confirm(`Delete "${a ? a.title : 'this response'}"? This cannot be undone.`)) return;
    await api('/api/admin/activities/' + id, { method: 'DELETE' });
    activities = activities.filter((x) => x.id !== id);
    render();
  }

  async function move(id, dir) {
    const i = activities.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= activities.length) return;
    const tmp = activities[i]; activities[i] = activities[j]; activities[j] = tmp;
    render();
    await api('/api/admin/reorder', { method: 'POST', body: JSON.stringify({ order: activities.map((a) => a.id) }) });
  }

  // ---- Modal ----
  const modal = $('modal');
  function openModal() { modal.hidden = false; }
  function closeModal() { modal.hidden = true; $('formError').hidden = true; }

  $('addBtn').addEventListener('click', () => {
    $('modalTitle').textContent = 'Add response';
    $('f_id').value = '';
    $('f_title').value = '';
    $('f_description').value = '';
    $('f_category').value = '';
    $('f_borough').value = '';
    $('f_cost').value = '0';
    $('f_costNote').value = '';
    $('f_url').value = '';
    $('f_active').checked = true;
    openModal();
    $('f_title').focus();
  });

  function openEdit(id) {
    const a = activities.find((x) => x.id === id);
    if (!a) return;
    $('modalTitle').textContent = 'Edit response';
    $('f_id').value = a.id;
    $('f_title').value = a.title;
    $('f_description').value = a.description;
    $('f_category').value = a.category;
    $('f_borough').value = a.borough;
    $('f_cost').value = a.cost;
    $('f_costNote').value = a.costNote;
    $('f_url').value = a.url;
    $('f_active').checked = a.active;
    openModal();
  }

  $('cancelBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  $('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('formError').hidden = true;
    const payload = {
      title: $('f_title').value.trim(),
      description: $('f_description').value.trim(),
      category: $('f_category').value.trim() || 'Other',
      borough: $('f_borough').value.trim() || 'Multiple',
      cost: Number($('f_cost').value) || 0,
      costNote: $('f_costNote').value.trim(),
      url: $('f_url').value.trim(),
      active: $('f_active').checked,
    };
    if (!payload.title) { showFormError('Title is required.'); return; }
    if (payload.cost > 50) { showFormError('Cost must be $50 or less per person.'); return; }

    const id = $('f_id').value;
    const res = id
      ? await api('/api/admin/activities/' + id, { method: 'PUT', body: JSON.stringify(payload) })
      : await api('/api/admin/activities', { method: 'POST', body: JSON.stringify(payload) });

    if (!res.ok) { const err = await res.json().catch(() => ({})); showFormError(err.error || 'Could not save.'); return; }
    closeModal();
    await load();
  });

  function showFormError(msg) { $('formError').textContent = msg; $('formError').hidden = false; }

  // ---- Toolbar wiring ----
  $('search').addEventListener('input', (e) => { search = e.target.value; render(); });
  $('filterActive').addEventListener('change', (e) => { filterActive = e.target.value; render(); });
  $('sortBy').addEventListener('change', (e) => { sortBy = e.target.value; render(); });

  // ---- utils ----
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  checkSession();
})();
