(() => {
  const folderCache = new Map();
  const fileCache = new Map();
  const draggableTypes = new Set(['folder', 'file']);
  let dragged = null;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/api/dossiers.php') && url.includes('action=list')) {
        response.clone().json().then((payload) => {
          if (!payload || payload.success === false) return;
          folderCache.clear();
          fileCache.clear();
          (payload.folders || []).forEach((folder) => folderCache.set(String(folder.id), folder));
          (payload.files || []).forEach((file) => fileCache.set(String(file.id), file));
          setTimeout(enhanceUi, 20);
        }).catch(() => {});
      }
    } catch (error) {}
    return response;
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  }

  function currentFileFromCard(card) {
    const id = String(card?.dataset?.id || '');
    if (fileCache.has(id)) return fileCache.get(id);
    const badge = card?.querySelector('.file-badge')?.textContent || '';
    const name = card?.querySelector('strong')?.textContent?.replace('★', '').trim() || 'Aperçu du fichier';
    return { id, extension: badge.toLowerCase(), original_name: name };
  }

  function enhanceUi() {
    enhanceCards();
    syncFavoriteState();
    patchUploadHelp();
  }

  function enhanceCards() {
    document.querySelectorAll('.dossier-item').forEach((card) => {
      const kind = card.dataset.kind;
      const id = card.dataset.id;
      if (!draggableTypes.has(kind) || !id || id === 'case-root') return;

      card.draggable = true;
      card.classList.add('is-sortable-card');

      card.querySelectorAll('.item-menu, .folder-logo-badge').forEach((node) => node.remove());

      if (kind === 'folder') {
        const folder = folderCache.get(String(id)) || {};
        const logoUrl = folder.division_logo_url || folder.logo_url || folder.service_logo_url || '';
        card.querySelector('.folder-real-logo')?.remove();
        if (logoUrl) {
          const logo = document.createElement('span');
          logo.className = 'folder-real-logo';
          logo.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="" loading="lazy" />`;
          card.appendChild(logo);
        }
      }

      const strong = card.querySelector('strong');
      if (strong && strong.textContent.includes('★') && !strong.querySelector('.favorite-star')) {
        const title = strong.textContent.replace('★', '').trim();
        strong.innerHTML = `${escapeHtml(title)} <span class="favorite-star">★</span>`;
        card.classList.add('is-favorite-card');
      } else if (strong && !strong.textContent.includes('★')) {
        card.classList.remove('is-favorite-card');
      }
    });
  }

  function syncFavoriteState() {
    const button = document.querySelector('#favoriteButton');
    if (!button) return;
    const isFavorite = button.textContent.includes('★');
    button.classList.toggle('is-favorite', isFavorite);
    button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    button.title = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
  }

  function patchUploadHelp() {
    const uploadHelp = document.querySelector('#uploadDropzone span');
    if (uploadHelp && !uploadHelp.dataset.updatedLimit) {
      uploadHelp.textContent = 'ou cliquez pour parcourir · JPG, PNG, PDF, MP4, MP3, TXT · max 250 Mo applicatif';
      uploadHelp.dataset.updatedLimit = '1';
    }
  }

  async function persistOrder() {
    const items = Array.from(document.querySelectorAll('#dossiersGrid .dossier-item'))
      .filter((card) => draggableTypes.has(card.dataset.kind) && card.dataset.id && card.dataset.id !== 'case-root')
      .map((card) => ({ type: card.dataset.kind, id: Number(card.dataset.id) }));
    if (!items.length) return;
    try {
      const response = await nativeFetch('/api/dossiers.php?action=reorder', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Erreur reorder.');
      showMiniToast('Ordre enregistré.', 'success');
    } catch (error) {
      showMiniToast('Impossible d’enregistrer l’ordre.', 'error');
    }
  }

  function cardFromEvent(event) {
    return event.target.closest('.dossier-item.is-sortable-card');
  }

  document.addEventListener('dragstart', (event) => {
    const card = cardFromEvent(event);
    if (!card) return;
    dragged = card;
    card.classList.add('is-dragging-card');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${card.dataset.kind}:${card.dataset.id}`);
  });

  document.addEventListener('dragend', () => {
    document.querySelectorAll('.is-dragging-card, .is-drop-before, .is-drop-after').forEach((el) => el.classList.remove('is-dragging-card', 'is-drop-before', 'is-drop-after'));
    dragged = null;
  });

  document.addEventListener('dragover', (event) => {
    const target = cardFromEvent(event);
    if (!dragged || !target || target === dragged || target.parentElement !== dragged.parentElement) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const before = event.clientX < rect.left + rect.width / 2;
    target.classList.toggle('is-drop-before', before);
    target.classList.toggle('is-drop-after', !before);
  });

  document.addEventListener('dragleave', (event) => {
    const target = cardFromEvent(event);
    if (target) target.classList.remove('is-drop-before', 'is-drop-after');
  });

  document.addEventListener('drop', (event) => {
    const target = cardFromEvent(event);
    if (!dragged || !target || target === dragged || target.parentElement !== dragged.parentElement) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const before = event.clientX < rect.left + rect.width / 2;
    target.classList.remove('is-drop-before', 'is-drop-after');
    if (before) target.parentElement.insertBefore(dragged, target);
    else target.parentElement.insertBefore(dragged, target.nextSibling);
    persistOrder();
  });

  document.addEventListener('dblclick', (event) => {
    const card = event.target.closest('.dossier-item.file');
    if (!card || !card.dataset.id) return;
    const file = currentFileFromCard(card);
    const ext = String(file?.extension || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'pdf', 'mp4', 'webm'].includes(ext)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openPreview(Number(card.dataset.id), file);
  }, true);

  function openPreview(id, file = {}) {
    const ext = String(file.extension || '').toLowerCase();
    const name = file.original_name || 'Aperçu du fichier';
    const src = `/api/dossiers.php?action=preview&id=${id}`;
    let content = '';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      content = `<img class="dossiers-preview-media" src="${src}" alt="${escapeHtml(name)}" />`;
    } else if (ext === 'pdf') {
      content = `<iframe class="dossiers-preview-frame" src="${src}" title="${escapeHtml(name)}"></iframe>`;
    } else if (['mp4', 'webm'].includes(ext)) {
      content = `<video class="dossiers-preview-media" src="${src}" controls autoplay></video>`;
    }

    const modal = document.createElement('div');
    modal.className = 'dossiers-preview-backdrop';
    modal.innerHTML = `
      <section class="dossiers-preview-window">
        <header class="dossiers-preview-header">
          <div><h3>${escapeHtml(name)}</h3><p>Aperçu sécurisé sans téléchargement</p></div>
          <button type="button" aria-label="Fermer">×</button>
        </header>
        <div class="dossiers-preview-body">${content}</div>
        <footer><a href="/api/dossiers.php?action=download&id=${id}" target="_blank" rel="noopener">Télécharger</a></footer>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelector('button')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  }

  function showMiniToast(message, type) {
    const existing = document.querySelector('#dossiersToast');
    if (existing) {
      existing.textContent = message;
      existing.dataset.type = type;
      existing.hidden = false;
      setTimeout(() => { existing.hidden = true; }, 2400);
    }
  }

  const observer = new MutationObserver(enhanceUi);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  document.addEventListener('DOMContentLoaded', enhanceUi);
  document.addEventListener('click', () => setTimeout(enhanceUi, 80));
  setTimeout(enhanceUi, 350);
})();
