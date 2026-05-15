const motdEditButton = document.querySelector('#motdEditButton');
const motdForm = document.querySelector('#motdForm');
const motdCancelButton = document.querySelector('#motdCancelButton');
const motdMessage = document.querySelector('#motdMessage');

function setMotdMessage(message, type = 'error') {
  if (!motdMessage) return;
  motdMessage.textContent = message;
  motdMessage.dataset.type = type;
}

if (motdEditButton && motdForm) {
  motdEditButton.addEventListener('click', () => {
    motdForm.hidden = false;
    motdEditButton.hidden = true;
  });
}

if (motdCancelButton && motdForm && motdEditButton) {
  motdCancelButton.addEventListener('click', () => {
    motdForm.hidden = true;
    motdEditButton.hidden = false;
    setMotdMessage('');
  });
}

if (motdForm) {
  motdForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = motdForm.title.value.trim();
    const body = motdForm.body.value.trim();

    setMotdMessage('Mise a jour de l annonce...', 'info');

    try {
      const response = await fetch('/api/update-motd.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ title, body })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMotdMessage(result.message || 'Mise a jour refusee.');
        return;
      }

      setMotdMessage(result.message || 'Annonce mise a jour.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMotdMessage('Erreur serveur ou reponse invalide.');
    }
  });
}
