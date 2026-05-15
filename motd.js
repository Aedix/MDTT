const motdEditButton = document.querySelector('#motdEditButton');
const motdForm = document.querySelector('#motdForm');
const motdCancelButton = document.querySelector('#motdCancelButton');
const motdMessage = document.querySelector('#motdMessage');
const motdView = document.querySelector('#motdView');
const motdTitleView = document.querySelector('#motdTitleView');
const motdBody = document.querySelector('#motdBody');
const toolbarButtons = document.querySelectorAll('.mdt-editor-toolbar button');

function setMotdMessage(message, type = 'error') {
  if (!motdMessage) return;
  motdMessage.textContent = message;
  motdMessage.dataset.type = type;
}

function insertAtSelection(textarea, before, after = '') {
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const replacement = `${before}${selected}${after}`;

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.focus();

  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  textarea.setSelectionRange(cursorStart, cursorEnd);
}

function promptAndInsert(type) {
  if (!motdBody) return;

  if (type === 'list') {
    insertAtSelection(motdBody, '[list]\n[*]Premier élément\n[*]Second élément\n[/list]');
    return;
  }

  if (type === 'url') {
    const url = window.prompt('URL du lien :');
    if (!url) return;
    const label = window.prompt('Texte affiché :') || url;
    insertAtSelection(motdBody, `[url=${url}]${label}[/url]`);
    return;
  }

  if (type === 'image') {
    const url = window.prompt('URL de l’image :');
    if (!url) return;
    insertAtSelection(motdBody, `[img]${url}[/img]`);
    return;
  }

  if (type === 'file') {
    const url = window.prompt('URL du fichier :');
    if (!url) return;
    const label = window.prompt('Nom affiché du fichier :') || 'Fichier joint';
    insertAtSelection(motdBody, `[file=${url}]${label}[/file]`);
  }
}

if (motdEditButton && motdForm && motdView) {
  motdEditButton.addEventListener('click', () => {
    motdForm.hidden = false;
    motdView.hidden = true;
    motdEditButton.hidden = true;
  });
}

if (motdCancelButton && motdForm && motdEditButton && motdView) {
  motdCancelButton.addEventListener('click', () => {
    motdForm.hidden = true;
    motdView.hidden = false;
    motdEditButton.hidden = false;
    setMotdMessage('');
  });
}

toolbarButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const wrap = button.dataset.wrap;
    const insert = button.dataset.insert;

    if (wrap) {
      const [before, after] = wrap.split('|');
      insertAtSelection(motdBody, before, after);
      return;
    }

    if (insert) {
      promptAndInsert(insert);
    }
  });
});

if (motdForm) {
  motdForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = motdForm.title.value.trim();
    const body = motdForm.body.value.trim();

    setMotdMessage('Mise à jour de l’annonce...', 'info');

    try {
      const response = await fetch('/api/update-motd.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ title, body })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMotdMessage(result.message || 'Mise à jour refusée.');
        return;
      }

      setMotdMessage(result.message || 'Annonce mise à jour.', 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMotdMessage('Erreur serveur ou réponse invalide.');
    }
  });
}
