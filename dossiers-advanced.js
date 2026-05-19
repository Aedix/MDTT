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
          setTimeout(enhanceCards, 20);
        }).catch(() => {});
      }
    } catch (error) {}
    return response;
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  }

  function logoText(folder) {
    const key = String(folder.logo_key || 'service').toLowerCase();
    const label = String(folder.logo_label || '').trim();
    if (label) return label.slice(0, 4).toUpperCase();
    const service = String(folder.service_code || 'SRV').slice(0, 4).toUpperCase();
    return key === 'crime' ? 'CRM' : key === 'fib' || key === 'service' ? service : key.slice(0, 4).toUpperCase();
  }

  function enhanceCards() {
    document.querySelectorAll('.dossier-item').forEach((card) => {
      const kind = card.dataset.kind;
      const id = card.dataset.id;
      if (!draggableTypes.has(kind) || !id || id === 'case-root') return;

      card.draggable = true;
      card.classList.add('is-sortable-card');

      const menu = card.querySelector('.item-menu');
      if (menu) {
        if (kind === 'folder') {
          const folder = folderCache.get(id) || {};
          menu.className = 'folder-logo-badge';
          menu.textContent = logoText(folder);
          menu.title = folder.logo_label || folder.logo_key || 'Logo service';
          menu.dataset.logo = folder.logo_key || 'service';
        } else {
          menu.remove();
        }
      }
    });
  }

  async function persistOrder() {
    const items = Array.from(document.querySelectorAll('#dossiersGrid .dossier-item'))
      .filter((card) => draggableTypes.has(card.dataset.kind) && card.dataset.id && card.dataset.id !== 'case-root')
      .map((card) => ({ type: card.dataset.kind, id: Number(card.dataset.id) }));
    if (!items.length) return;
    try {
      await nativeFetch('/api/dossiers.php?action=reorder', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
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
    const file = fileCache.get(String(card.dataset.id));
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

  function patchForms() {
    document.querySelectorAll('#folderCreateForm, #editForm').forEach((form) => {
      if (form.dataset.logoPatched === '1') return;
      form.dataset.logoPatched = '1';
      const isFolderForm = form.id === 'folderCreateForm' || document.querySelector('#dossiersDrawerTitle')?.textContent.toLowerCase().includes('dossier');
      if (!isFolderForm) return;
      const currentId = document.querySelector('.dossier-item.folder.is-selected')?.dataset.id;
      const current = currentId ? folderCache.get(currentId) : null;
      const logoBlock = document.createElement('div');
      logoBlock.className = 'dossiers-logo-config';
      logoBlock.innerHTML = `
        <label>Logo affiché sur la carte
          <select name="logo_key">
            <option value="service" ${current?.logo_key === 'service' ? 'selected' : ''}>Service actif</option>
            <option value="fib" ${current?.logo_key === 'fib' ? 'selected' : ''}>FIB</option>
            <option value="crime" ${current?.logo_key === 'crime' ? 'selected' : ''}>Division Crime</option>
            <option value="custom" ${current?.logo_key === 'custom' ? 'selected' : ''}>Personnalisé</option>
          </select>
        </label>
        <label>Texte court du logo
          <input name="logo_label" maxlength="4" placeholder="FIB / CRM / SP" value="${escapeHtml(current?.logo_label || '')}" />
        </label>`;
      form.appendChild(logoBlock);
    });

    const uploadHelp = document.querySelector('#uploadDropzone span');
    if (uploadHelp && !uploadHelp.dataset.updatedLimit) {
      uploadHelp.textContent = 'ou cliquez pour parcourir · JPG, PNG, PDF, MP4, MP3, TXT · max 250 Mo applicatif';
      uploadHelp.dataset.updatedLimit = '1';
    }
  }

  const nativeJsonStringify = JSON.stringify;
  JSON.stringify = function patchedStringify(value, ...rest) {
    try {
      if (value && typeof value === 'object' && (value.name || value.type === 'folder')) {
        const visibleForm = document.querySelector('#folderCreateForm, #editForm');
        if (visibleForm) {
          const fd = new FormData(visibleForm);
          if (fd.has('logo_key')) value.logo_key = String(fd.get('logo_key') || 'service');
          if (fd.has('logo_label')) value.logo_label = String(fd.get('logo_label') || '').trim();
        }
      }
    } catch (error) {}
    return nativeJsonStringify.call(JSON, value, ...rest);
  };

  function showMiniToast(message, type) {
    const existing = document.querySelector('#dossiersToast');
    if (existing) {
      existing.textContent = message;
      existing.dataset.type = type;
      existing.hidden = false;
      setTimeout(() => { existing.hidden = true; }, 2400);
    }
  }

  const observer = new MutationObserver(() => {
    enhanceCards();
    patchForms();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', () => {
    enhanceCards();
    patchForms();
  });
})();
