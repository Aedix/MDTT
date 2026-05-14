const loginForm = document.querySelector('#loginForm');
const formMessage = document.querySelector('#formMessage');
const forgotPasswordButton = document.querySelector('#forgotPasswordButton');
const createAccountButton = document.querySelector('#createAccountButton');

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = loginForm.username.value.trim();
  const password = loginForm.password.value.trim();

  if (!username || !password) {
    formMessage.textContent = 'Username et password obligatoires.';
    return;
  }

  formMessage.textContent = 'Connexion non reliée au backend pour le moment.';
});

forgotPasswordButton.addEventListener('click', () => {
  formMessage.textContent = 'Module mot de passe oublié à créer plus tard.';
});

createAccountButton.addEventListener('click', () => {
  formMessage.textContent = 'Module création de compte à créer plus tard.';
});
