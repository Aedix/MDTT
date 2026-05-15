const formMessage = document.querySelector('#formMessage');
const statusButtons = document.querySelectorAll('.account-status-button');
const deleteButtons = document.querySelectorAll('.account-delete-button');
const rankSelects = document.querySelectorAll('.account-rank-select');
const serviceAssignButtons = document.querySelectorAll('.service-assign-button');
const serviceRemoveButtons = document.querySelectorAll('.service-remove-button');
const serviceSelects = document.querySelectorAll('.account-service-select');

function setMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

statusButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const userId = Number(button.dataset.userId);
    const isActive = Number(button.dataset.isActive);
    setMessage('Mise à jour du compte...', 'info');

    try {
      const response = await fetch('/api/admin/update-account-status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId, is_active: isActive })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || 'Mise à jour refusée.');
        return;
      }
      setMessage(result.message || 'Compte mis à jour.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});

deleteButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const userId = Number(button.dataset.userId);
    const username = button.dataset.username || 'cet utilisateur';
    if (!window.confirm(`Supprimer définitivement le compte ${username} ?`)) return;
    setMessage('Suppression du compte...', 'info');

    try {
      const response = await fetch('/api/admin/delete-account.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || 'Suppression refusée.');
        return;
      }
      setMessage(result.message || 'Compte supprimé.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});

rankSelects.forEach((select) => {
  select.addEventListener('change', async () => {
    const userId = Number(select.dataset.userId);
    const rankId = Number(select.value);
    if (!rankId) return;
    setMessage('Mise à jour du grade...', 'info');

    try {
      const response = await fetch('/api/admin/update-account-rank.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId, rank_id: rankId })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || 'Modification du grade refusée.');
        return;
      }
      setMessage(result.message || 'Grade mis à jour.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});

serviceSelects.forEach((select) => {
  select.addEventListener('change', () => {
    const userId = select.dataset.userId;
    const serviceId = select.value;
    const rankSelect = document.querySelector(`#service-rank-${userId}`);
    if (!rankSelect) return;

    [...rankSelect.options].forEach((option) => {
      if (!option.value) {
        option.hidden = false;
        return;
      }
      option.hidden = option.dataset.serviceId !== serviceId;
    });
    rankSelect.value = '';
  });
});

serviceAssignButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const userId = Number(button.dataset.userId);
    const serviceSelect = document.querySelector(`#service-${userId}`);
    const rankSelect = document.querySelector(`#service-rank-${userId}`);
    const primaryInput = document.querySelector(`.account-service-primary[data-user-id="${userId}"]`);

    const serviceId = Number(serviceSelect?.value || 0);
    const rankId = Number(rankSelect?.value || 0);
    const isPrimary = Boolean(primaryInput?.checked);

    if (!serviceId) {
      setMessage('Choisis un service à affecter.');
      return;
    }

    setMessage('Affectation du service...', 'info');

    try {
      const response = await fetch('/api/admin/assign-user-service.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId, service_id: serviceId, rank_id: rankId, is_primary: isPrimary })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || 'Affectation refusée.');
        return;
      }
      setMessage(result.message || 'Service affecté.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});

serviceRemoveButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const userId = Number(button.dataset.userId);
    const serviceId = Number(button.dataset.serviceId);
    if (!window.confirm('Retirer ce service du compte ?')) return;
    setMessage('Retrait du service...', 'info');

    try {
      const response = await fetch('/api/admin/remove-user-service.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId, service_id: serviceId })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage(result.message || 'Retrait refusé.');
        return;
      }
      setMessage(result.message || 'Service retiré.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});
