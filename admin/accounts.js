const formMessage = document.querySelector('#formMessage');
const buttons = document.querySelectorAll('.account-status-button');

function setMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

buttons.forEach((button) => {
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
