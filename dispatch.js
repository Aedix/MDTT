const createUnitButton = document.querySelector('#createUnitButton');
const createUnitForm = document.querySelector('#createUnitForm');
const cancelCreateUnitButton = document.querySelector('#cancelCreateUnitButton');
const dispatchMessage = document.querySelector('#dispatchMessage');
const dispatchUpdateForms = document.querySelectorAll('.dispatch-update-form');
const dispatchCloseButtons = document.querySelectorAll('.dispatch-close-button');
const dispatchEditButtons = document.querySelectorAll('.dispatch-edit-button');
const dispatchCancelEditButtons = document.querySelectorAll('.dispatch-cancel-edit-button');
const dispatchDrawer = document.querySelector('#dispatchDrawer');
const dispatchDrawerClose = document.querySelector('#dispatchDrawerClose');
const dispatchDrawerApply = document.querySelector('#dispatchDrawerApply');
const dispatchDrawerAgents = document.querySelector('#dispatchDrawerAgents');
const dispatchAgentButtons = document.querySelectorAll('.dispatch-agent-button, .dispatch-agent-summary');

let activeAgentTarget = null;

function setDispatchMessage(message, type = 'error') {
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

function openDrawer(target) {
  activeAgentTarget = target;
  const selectedMembers = new Set(getSelectedMembersFromTarget(target));

  dispatchDrawerAgents?.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = selectedMembers.has(Number(checkbox.value));
  });

  if (dispatchDrawer) dispatchDrawer.hidden = false;
}

function closeDrawer() {
  if (dispatchDrawer) dispatchDrawer.hidden = true;
  activeAgentTarget = null;
}

if (createUnitButton && createUnitForm) {
  createUnitButton.addEventListener('click', () => {
    createUnitForm.hidden = false;
    createUnitButton.hidden = true;
    setDispatchMessage('');
  });
}

if (cancelCreateUnitButton && createUnitForm && createUnitButton) {
  cancelCreateUnitButton.addEventListener('click', () => {
    createUnitForm.hidden = true;
    createUnitButton.hidden = false;
    setDispatchMessage('');
  });
}

dispatchAgentButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.closest('form');
    if (!target) return;
    openDrawer(target);
  });
});

if (dispatchDrawerClose) dispatchDrawerClose.addEventListener('click', closeDrawer);

if (dispatchDrawer) {
  dispatchDrawer.addEventListener('click', (event) => {
    if (event.target === dispatchDrawer) closeDrawer();
  });
}

if (dispatchDrawerApply) {
  dispatchDrawerApply.addEventListener('click', () => {
    if (!activeAgentTarget) return;
    const members = [...dispatchDrawerAgents.querySelectorAll('input[type="checkbox"]:checked')].map((input) => Number(input.value));
    setTargetMembers(activeAgentTarget, members);
    closeDrawer();
  });
}

if (createUnitForm) {
  createUnitForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = readUnitPayload(createUnitForm);

    if (!payload.name || !payload.status) {
      setDispatchMessage('Nom d’unité et statut obligatoires.');
      return;
    }

    setDispatchMessage('Création de l’unité...', 'info');

    try {
      await sendDispatchRequest('/api/dispatch-create-unit.php', payload);
      window.location.reload();
    } catch (error) {
      setDispatchMessage(error.message);
    }
  });
}

dispatchEditButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const viewRow = button.closest('.dispatch-view-row');
    if (!viewRow) return;
    const unitId = viewRow.dataset.unitId;
    const editRow = document.querySelector(`.dispatch-edit-row[data-unit-id="${unitId}"]`);
    viewRow.hidden = true;
    if (editRow) editRow.hidden = false;
  });
});

dispatchCancelEditButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const editRow = button.closest('.dispatch-edit-row');
    if (!editRow) return;
    const unitId = editRow.dataset.unitId;
    const viewRow = document.querySelector(`.dispatch-view-row[data-unit-id="${unitId}"]`);
    editRow.hidden = true;
    if (viewRow) viewRow.hidden = false;
  });
});

dispatchUpdateForms.forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = readUnitPayload(form);

    setDispatchMessage('Mise à jour de l’unité...', 'info');

    try {
      await sendDispatchRequest('/api/dispatch-update-unit.php', payload);
      window.location.reload();
    } catch (error) {
      setDispatchMessage(error.message);
    }
  });
});

dispatchCloseButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const unitId = Number(button.dataset.unitId || 0);
    if (!unitId) return;
    if (!window.confirm('Fermer cette unité dispatch ?')) return;

    setDispatchMessage('Fermeture de l’unité...', 'info');

    try {
      await sendDispatchRequest('/api/dispatch-close-unit.php', { unit_id: unitId });
      window.location.reload();
    } catch (error) {
      setDispatchMessage(error.message);
    }
  });
});
