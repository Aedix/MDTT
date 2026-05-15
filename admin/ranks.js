const formMessage = document.querySelector('#formMessage');
const createRankForm = document.querySelector('#createRankForm');
const updateRankButtons = document.querySelectorAll('.rank-update-button');
const deleteRankButtons = document.querySelectorAll('.rank-delete-button');

function setMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

if (createRankForm) {
  createRankForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const serviceId = Number(createRankForm.serviceId.value);
    const name = createRankForm.name.value.trim();
    const level = Number(createRankForm.level.value);
    const sortOrder = Number(createRankForm.sortOrder.value || level);
    const isCommand = createRankForm.isCommand.checked;

    setMessage('Création du grade...', 'info');

    try {
      const response = await fetch('/api/admin/create-rank.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          service_id: serviceId,
          name,
          level,
          sort_order: sortOrder,
          is_command: isCommand,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message || 'Création refusée.');
        return;
      }

      setMessage(result.message || 'Grade créé.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
}

updateRankButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const rankId = Number(button.dataset.rankId);
    const name = document.querySelector(`#rank-name-${rankId}`).value.trim();
    const level = Number(document.querySelector(`#rank-level-${rankId}`).value);
    const sortOrder = Number(document.querySelector(`#rank-sort-${rankId}`).value || level);
    const isCommand = document.querySelector(`#rank-command-${rankId}`).checked;

    setMessage('Mise à jour du grade...', 'info');

    try {
      const response = await fetch('/api/admin/update-rank.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          rank_id: rankId,
          name,
          level,
          sort_order: sortOrder,
          is_command: isCommand,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message || 'Modification refusée.');
        return;
      }

      setMessage(result.message || 'Grade mis à jour.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});

deleteRankButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const rankId = Number(button.dataset.rankId);
    const name = button.dataset.rankName || 'ce grade';

    if (!window.confirm(`Désactiver le grade ${name} ?`)) {
      return;
    }

    setMessage('Désactivation du grade...', 'info');

    try {
      const response = await fetch('/api/admin/delete-rank.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ rank_id: rankId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message || 'Désactivation refusée.');
        return;
      }

      setMessage(result.message || 'Grade désactivé.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage('Erreur serveur ou réponse invalide.');
    }
  });
});
