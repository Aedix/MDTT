const registerForm = document.querySelector('#registerForm');
const formMessage = document.querySelector('#formMessage');

function setMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = registerForm.username.value.trim();
  const password = registerForm.password.value;
  const passwordConfirm = registerForm.passwordConfirm.value;
  const rankId = registerForm.rankId.value;

  if (!username || !password || !passwordConfirm || !rankId) {
    setMessage('Tous les champs sont obligatoires.');
    return;
  }

  setMessage('Création du compte en cours...', 'info');

  try {
    const response = await fetch('/api/register.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        username,
        password,
        password_confirm: passwordConfirm,
        rank_id: Number(rankId),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setMessage(result.message || 'Création refusée.');
      return;
    }

    setMessage(result.message || 'Compte créé.', 'success');
    registerForm.reset();
  } catch (error) {
    setMessage('Erreur serveur ou réponse invalide.');
  }
});
