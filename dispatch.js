const createUnitButton = document.querySelector('#createUnitButton');
const createUnitForm = document.querySelector('#createUnitForm');
const cancelCreateUnitButton = document.querySelector('#cancelCreateUnitButton');
const dispatchMessage = document.querySelector('#dispatchMessage');
const dispatchUpdateForms = document.querySelectorAll('.dispatch-update-form');
const dispatchCloseButtons = document.querySelectorAll('.dispatch-close-button');

function setDispatchMessage(message, type = 'error') {
  if (!dispatchMessage) return;
  dispatchMessage.textContent = message;
  dispatchMessage.dataset.type = type;
}

function getSelectedMembers(container) {
  return [...container.querySelectorAll('.dispatch-member-checkbox:checked')].map((input) => Number(input.value));
}

function readUnitPayload(container) {
  return {
    unit_id: Number(container.dataset.unitId || 0),
    name: container.querySelector('[name="name"]')?.value.trim() || '',
    status: container.querySelector('[name="status"]')?.value.trim() || '',
    division_id: Number(container.querySelector('[name="division_id"]')?.value || 0),
    ppa_level: container.querySelector('[name="ppa_level"]')?.value || 'PPA I',
    member_ids: getSelectedMembers(container),
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
