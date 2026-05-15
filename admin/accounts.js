const formMessage = document.querySelector('#formMessage');
const statusButtons = document.querySelectorAll('.account-status-button');
const deleteButtons = document.querySelectorAll('.account-delete-button');
const rankSelects = document.querySelectorAll('.account-rank-select');

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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          user_id: userId,
          is_active: isActive,
        }),
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

    const confirmed = window.confirm(`Supprimer définitivement le compte ${username} ?`);

    if (!confirmed) {
      return;
    }

    setMessage('Suppression du compte...', 'info');

    try {
      const response = await fetch('/api/admin/delete-account.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          user_id: userId,
        }),
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

    if (!rankId) {
      return;
    }

    setMessage('Mise à jour du grade...', 'info');

    try {
      const response = await fetch('/api/admin/update-account-rank.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          user_id: userId,
          rank_id: rankId,
        }),
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
