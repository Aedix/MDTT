const loginForm = document.querySelector('#loginForm');
const formMessage = document.querySelector('#formMessage');
const forgotPasswordButton = document.querySelector('#forgotPasswordButton');
const createAccountButton = document.querySelector('#createAccountButton');

function setMessage(message, type = 'error') {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;

  if (!username || !password) {
    setMessage('Username et password obligatoires.');
    return;
  }

  setMessage('Connexion en cours...', 'info');

  try {
    const response = await fetch('/api/login.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setMessage(result.message || 'Connexion refusée.');
      return;
    }

    setMessage(result.message || 'Connexion réussie.', 'success');
    window.location.href = result.redirect || '/dashboard.php';
  } catch (error) {
    setMessage('Erreur serveur ou réponse invalide. Vérifie la configuration PHP/BDD.');
  }
});

forgotPasswordButton.addEventListener('click', () => {
  setMessage('Module mot de passe oublié à créer plus tard.', 'info');
});

createAccountButton.addEventListener('click', () => {
  window.location.href = '/register.php';
});
