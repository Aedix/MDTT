const dispatchStylesheet = document.createElement('link');
dispatchStylesheet.rel = 'stylesheet';
dispatchStylesheet.href = '/dispatch.css?v=2';
document.head.appendChild(dispatchStylesheet);

let activeAgentTarget = null;
let lastDashboardHash = '';
let syncInProgress = false;

function setDispatchMessage(message, type = 'error') {
  const dispatchMessage = document.querySelector('#dispatchMessage');
  if (!dispatchMessage) return;
  dispatchMessage.textContent = message;
  dispatchMessage.dataset.type = type;
}

function splitMembers(value) {
  if (!value) return [];
  return value.split(',').map((id) => Number(id.trim())).filter((id) => id > 0);
}

function setTargetMembers(target, members) {
  const value = members.join(',');
  const input = target?.querySelector('.dispatch-members-input');
  const button = target?.querySelector('.dispatch-agent-button');
  if (input) input.value = value;
  if (button) button.dataset.members = value;
}

function getSelectedMembersFromTarget(container) {
  return splitMembers(container.querySelector('.dispatch-members-input')?.value || '');
}

function readUnitPayload(container) {
  return {
    unit_id: Number(container.dataset.unitId || 0),
    name: container.querySelector('[name="name"]')?.value.trim() || '',
    status: container.querySelector('[name="status"]')?.value.trim() || '',
    comment: container.querySelector('[name="comment"]')?.value.trim() || '',
    division_id: Number(container.querySelector('[name="division_id"]')?.value || 0),
    ppa_level: container.querySelector('[name="ppa_level"]')?.value || 'PPA I',
    member_ids: getSelectedMembersFromTarget(container),
  };
}

async function sendDispatchRequest(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Action dispatch refusée.');
  }

  return result;
}

function isDispatchBusy() {
  const createForm = document.querySelector('#createUnitForm');
  const drawer = document.querySelector('#dispatchDrawer');
  return Boolean(
    (createForm && !createForm.hidden) ||
    document.querySelector('.dispatch-edit-row:not([hidden])') ||
    (drawer && !drawer.hidden)
  );
}

function openDrawer(target) {
  activeAgentTarget = target;
  const selectedMembers = new Set(getSelectedMembersFromTarget(target));
  const dispatchDrawer = document.querySelector('#dispatchDrawer');
  const dispatchDrawerAgents = document.querySelector('#dispatchDrawerAgents');

  dispatchDrawerAgents?.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = selectedMembers.has(Number(checkbox.value));
  });

  if (dispatchDrawer) dispatchDrawer.hidden = false;
}

function closeDrawer() {
  const dispatchDrawer = document.querySelector('#dispatchDrawer');
  if (dispatchDrawer) dispatchDrawer.hidden = true;
  activeAgentTarget = null;
}

function applyDashboardState(state, force = false) {
  if (!state || !state.success) return;
  if (!force && state.hash && state.hash === lastDashboardHash) return;

  if (window.applyMotdState) {
    window.applyMotdState(state.motd);
  }

  if (window.applyShiftState) {
    window.applyShiftState(state.shift);
  }

  if (!isDispatchBusy() || force) {
    const dispatchList = document.querySelector('.dispatch-list');
    const dutyList = document.querySelector('.mdt-duty-list.compact');
    const drawerAgents = document.querySelector('#dispatchDrawerAgents');

    if (dispatchList && typeof state.dispatch_html === 'string') {
      dispatchList.innerHTML = state.dispatch_html;
    }

    if (dutyList && typeof state.duty_html === 'string') {
      dutyList.innerHTML = state.duty_html;
    }

    if (drawerAgents && typeof state.drawer_agents_html === 'string') {
      drawerAgents.innerHTML = state.drawer_agents_html;
    }
  }

  lastDashboardHash = state.hash || '';
}

async function syncDashboardState(force = false) {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const response = await fetch('/api/dashboard-state.php?t=' + Date.now(), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const state = await response.json();

    if (response.ok && state.success) {
      applyDashboardState(state, force);
    }
  } catch (error) {
    // Silent fail: next polling cycle will retry.
  } finally {
    syncInProgress = false;
  }
}

window.syncDashboardState = syncDashboardState;

document.addEventListener('click', async (event) => {
  const createUnitButton = event.target.closest('#createUnitButton');
  if (createUnitButton) {
    const createUnitForm = document.querySelector('#createUnitForm');
    if (createUnitForm) createUnitForm.hidden = false;
    createUnitButton.hidden = true;
    setDispatchMessage('');
    return;
  }

  const cancelCreateUnitButton = event.target.closest('#cancelCreateUnitButton');
  if (cancelCreateUnitButton) {
    const createUnitForm = document.querySelector('#createUnitForm');
    const createButton = document.querySelector('#createUnitButton');
    if (createUnitForm) createUnitForm.hidden = true;
    if (createButton) createButton.hidden = false;
    setDispatchMessage('');
    await syncDashboardState(true);
    return;
  }

  const agentButton = event.target.closest('.dispatch-agent-button, .dispatch-agent-summary');
  if (agentButton) {
    const target = agentButton.closest('form');
    if (!target) return;
    openDrawer(target);
    return;
  }

  if (event.target.closest('#dispatchDrawerClose')) {
    closeDrawer();
    return;
  }

  const drawer = document.querySelector('#dispatchDrawer');
  if (drawer && event.target === drawer) {
    closeDrawer();
    return;
  }

  if (event.target.closest('#dispatchDrawerApply')) {
    if (!activeAgentTarget) return;
    const dispatchDrawerAgents = document.querySelector('#dispatchDrawerAgents');
    const members = [...dispatchDrawerAgents.querySelectorAll('input[type="checkbox"]:checked')].map((input) => Number(input.value));
    setTargetMembers(activeAgentTarget, members);
    closeDrawer();
    return;
  }

  const editButton = event.target.closest('.dispatch-edit-button');
  if (editButton) {
    const viewRow = editButton.closest('.dispatch-view-row');
    if (!viewRow) return;
    const unitId = viewRow.dataset.unitId;
    const editRow = document.querySelector(`.dispatch-edit-row[data-unit-id="${unitId}"]`);
    viewRow.hidden = true;
    if (editRow) editRow.hidden = false;
    return;
  }

  const cancelEditButton = event.target.closest('.dispatch-cancel-edit-button');
  if (cancelEditButton) {
    const editRow = cancelEditButton.closest('.dispatch-edit-row');
    if (!editRow) return;
    const unitId = editRow.dataset.unitId;
    const viewRow = document.querySelector(`.dispatch-view-row[data-unit-id="${unitId}"]`);
    editRow.hidden = true;
    if (viewRow) viewRow.hidden = false;
    await syncDashboardState(true);
    return;
  }

  const closeButton = event.target.closest('.dispatch-close-button');
  if (closeButton) {
    const unitId = Number(closeButton.dataset.unitId || 0);
    if (!unitId) return;
    if (!window.confirm('Fermer cette unité dispatch ?')) return;

    setDispatchMessage('Fermeture de l’unité...', 'info');

    try {
      await sendDispatchRequest('/api/dispatch-close-unit.php', { unit_id: unitId });
      await syncDashboardState(true);
      setDispatchMessage('');
    } catch (error) {
      setDispatchMessage(error.message);
    }
  }
});

document.addEventListener('submit', async (event) => {
  const createForm = event.target.closest('#createUnitForm');
  const updateForm = event.target.closest('.dispatch-update-form');

  if (!createForm && !updateForm) return;
  event.preventDefault();

  const form = createForm || updateForm;
  const payload = readUnitPayload(form);

  if (!payload.name || !payload.status) {
    setDispatchMessage('Nom d’unité et statut obligatoires.');
    return;
  }

  setDispatchMessage(createForm ? 'Création de l’unité...' : 'Mise à jour de l’unité...', 'info');

  try {
    await sendDispatchRequest(createForm ? '/api/dispatch-create-unit.php' : '/api/dispatch-update-unit.php', payload);

    const createButton = document.querySelector('#createUnitButton');
    if (createForm && createButton) {
      createForm.hidden = true;
      createButton.hidden = false;
    }

    await syncDashboardState(true);
    setDispatchMessage('');
  } catch (error) {
    setDispatchMessage(error.message);
  }
});

syncDashboardState(true);
window.setInterval(() => syncDashboardState(false), 2000);
