const formMessage = document.querySelector('#formMessage');
const serviceCards = document.querySelectorAll('.service-card.available');
const logoutButton = document.querySelector('#logoutButton');

function setMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

serviceCards.forEach((card) => {
  card.addEventListener('click', async () => {
    const serviceId = Number(card.dataset.serviceId);
    setMessage('Ouverture du service...', 'info');

    try {
      const response = await fetch('/api/select-service.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ service_id: serviceId })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message || 'Selection refusee.');
        return;
      }

      window.location.href = result.redirect || '/dashboard.php';
    } catch (error) {
      setMessage('Erreur serveur ou reponse invalide.');
    }
  });
});

logoutButton.addEventListener('click', async () => {
  const response = await fetch('/api/logout.php', {
    method: 'POST',
    credentials: 'same-origin'
  });
  const result = await response.json();
  window.location.href = result.redirect || '/index.html';
});
