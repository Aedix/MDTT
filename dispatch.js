const dashboardReportsNavLink = [...document.querySelectorAll('.mdt-nav-link')].find((link) => (link.textContent || '').trim().toLowerCase().startsWith('rapports'));
if (dashboardReportsNavLink) {
  dashboardReportsNavLink.href = '/reports.php';
  dashboardReportsNavLink.classList.remove('disabled');
  dashboardReportsNavLink.querySelector('.mdt-placeholder')?.remove();
}

const dispatchStylesheet = document.createElement('link');
dispatchStylesheet.rel = 'stylesheet';
dispatchStylesheet.href = '/dispatch.css?v=3';
document.head.appendChild(dispatchStylesheet);

const motdToolsScript = document.createElement('script');
motdToolsScript.src = '/motd-tools.js?v=1';
motdToolsScript.defer = true;
document.head.appendChild(motdToolsScript);

let activeAgentTarget = null;
let lastDashboardHash = '';
let lastRealtimeVersion = 0;
let syncInProgress = false;
let versionCheckInProgress = false;
let hasPendingDashboardSync = false;
let pollingDelay = 3000;
const minPollingDelay = 3000;
const maxPollingDelay = 10000;

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

function getUnitNameFromRow(row) {
  const field = row.querySelector('[name="name"]');
  if (field) return field.value.trim();
  return row.querySelector('strong')?.textContent?.trim() || '';
}

function naturalCompareUnitNames(a, b) {
  return getUnitNameFromRow(a).localeCompare(getUnitNameFromRow(b), 'fr', {
    numeric: true,
    sensitivity: 'base',
  });
}

function sortDispatchRows() {
  const list = document.querySelector('.dispatch-list');
  if (!list) return;

  const pairs = [...list.querySelectorAll('.dispatch-view-row')].map((viewRow) => {
    const unitId = viewRow.dataset.unitId;
    return {
      viewRow,
      editRow: list.querySelector(`.dispatch-edit-row[data-unit-id="${unitId}"]`),
    };
  });

  pairs.sort((a, b) => naturalCompareUnitNames(a.viewRow, b.viewRow));

  pairs.forEach(({ viewRow, editRow }) => {
    list.appendChild(viewRow);
    if (editRow) list.appendChild(editRow);
  });
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

  if (typeof result.version === 'number') {
    lastRealtimeVersion = result.version;
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

function isDashboardLockedForEditing() {
  return Boolean(isDispatchBusy() || (window.isMotdEditing && window.isMotdEditing()));
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

async function flushPendingDashboardSync() {
  if (!hasPendingDashboardSync || isDashboardLockedForEditing()) return;
  hasPendingDashboardSync = false;
  await syncDashboardState(true);
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
      sortDispatchRows();
    }

    if (dutyList && typeof state.duty_html === 'string') {
      dutyList.innerHTML = state.duty_html;
    }

    if (drawerAgents && typeof state.drawer_agents_html === 'string') {
      drawerAgents.innerHTML = state.drawer_agents_html;
    }
  } else {
    hasPendingDashboardSync = true;
  }

  lastDashboardHash = state.hash || '';
  if (typeof state.version === 'number') {
    lastRealtimeVersion = state.version;
  }
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

async function checkDashboardVersion() {
  if (document.hidden || versionCheckInProgress || syncInProgress) {
    window.setTimeout(checkDashboardVersion, pollingDelay);
    return;
  }

  versionCheckInProgress = true;

  try {
    const response = await fetch('/api/dashboard-version.php?t=' + Date.now(), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    const result = await response.json();

    if (response.ok && result.success) {
      const serverVersion = Number(result.version || 0);

      if (serverVersion !== lastRealtimeVersion) {
        lastRealtimeVersion = serverVersion;
        pollingDelay = minPollingDelay;

        if (isDashboardLockedForEditing()) {
          hasPendingDashboardSync = true;
        } else {
          hasPendingDashboardSync = false;
          await syncDashboardState(true);
        }
      } else {
        pollingDelay = Math.min(maxPollingDelay, pollingDelay + 1000);
      }
    }
  } catch (error) {
    pollingDelay = Math.min(maxPollingDelay, pollingDelay + 1000);
  } finally {
    versionCheckInProgress = false;
    window.setTimeout(checkDashboardVersion, pollingDelay);
  }
}

window.syncDashboardState = syncDashboardState;

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (isDashboardLockedForEditing()) {
      hasPendingDashboardSync = true;
    } else {
      syncDashboardState(true);
    }
  }
});

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
    await flushPendingDashboardSync();
    sortDispatchRows();
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
    await flushPendingDashboardSync();
    return;
  }

  const drawer = document.querySelector('#dispatchDrawer');
  if (drawer && event.target === drawer) {
    closeDrawer();
    await flushPendingDashboardSync();
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
    await flushPendingDashboardSync();
    sortDispatchRows();
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
    sortDispatchRows();
    setDispatchMessage('');
  } catch (error) {
    setDispatchMessage(error.message);
  }
});

syncDashboardState(true);
sortDispatchRows();
window.setTimeout(checkDashboardVersion, pollingDelay);
