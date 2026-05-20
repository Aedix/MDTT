(() => {
  let dragged = null;
  let isDragging = false;
  let currentBreadcrumb = [];
  let currentParentId = null;

  const nativeFetch = window.fetch.bind(window);

  function toast(message, type = 'info') {
    const existing = document.querySelector('#dossiersToast');
    if (existing) {
      existing.textContent = message;
      existing.dataset.type = type;
      existing.hidden = false;
      setTimeout(() => { existing.hidden = true; }, type === 'error' ? 4200 : 2600);
      return;
    }

    const feedback = document.querySelector('#dossierFeedback');
    if (feedback) {
      feedback.textContent = message;
      feedback.dataset.type = type;
    }
  }

  function cacheListPayload(payload) {
    if (!payload || payload.success === false) return;
    currentBreadcrumb = Array.isArray(payload.breadcrumb) ? payload.breadcrumb : [];
    currentParentId = payload.parent_id === null || payload.parent_id === undefined ? null : Number(payload.parent_id);
  }

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/api/dossiers.php') && url.includes('action=list')) {
        response.clone().json().then(cacheListPayload).catch(() => {});
      }
    } catch (error) {}
    return response;
  };

  function itemFromCard(card) {
    if (!card) return null;
    const kind = card.dataset.kind;
    const id = Number(card.dataset.id);
    if (!['folder', 'file'].includes(kind) || !Number.isFinite(id) || id <= 0) return null;
    return { type: kind, id, card };
  }

  function resetDropTargets() {
    document.querySelectorAll('.is-drop-target, .is-drop-before, .is-drop-after, .is-drop-invalid, .is-drag-moving').forEach((node) => {
      node.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after', 'is-drop-invalid', 'is-drag-moving');
    });
  }

  function getDropZone(event, card) {
    const rect = card.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);

    if (ratio <= 0.18) return 'before';
    if (ratio >= 0.82) return 'after';
    return 'inside';
  }

  function parentFolderForBackCard() {
    if (!currentBreadcrumb.length) return null;
    if (currentBreadcrumb.length <= 1) return null;
    const parent = currentBreadcrumb[currentBreadcrumb.length - 2];
    return parent && Number(parent.id) > 0 ? Number(parent.id) : null;
  }

  function getTargetFromEvent(event) {
    const backCard = event.target.closest('.dossier-back-card');
    if (backCard) {
      return {
        mode: 'move',
        folderId: parentFolderForBackCard(),
        label: 'dossier parent',
        card: backCard,
      };
    }

    const card = event.target.closest('.dossier-item');
    if (!card || card === dragged?.card || card.dataset.kind === 'back') return null;

    const zone = getDropZone(event, card);

    if (zone === 'before' || zone === 'after') {
      return {
        mode: 'reorder',
        position: zone,
        card,
      };
    }

    if (card.classList.contains('folder') && card.dataset.kind === 'folder') {
      const id = Number(card.dataset.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      return {
        mode: 'move',
        folderId: id,
        label: card.querySelector('strong')?.textContent?.replace('★', '').trim() || 'dossier',
        card,
      };
    }

    return null;
  }

  async function moveItem(item, targetFolderId, label) {
    const response = await nativeFetch('/api/dossiers_move.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: item.type, id: item.id, target_folder_id: targetFolderId }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || 'Déplacement impossible.');

    item.card.remove();
    toast(`${item.type === 'folder' ? 'Dossier' : 'Fichier'} déplacé vers ${label}.`, 'success');
  }

  async function persistOrder() {
    const items = Array.from(document.querySelectorAll('#dossiersGrid .dossier-item'))
      .filter((card) => ['folder', 'file'].includes(card.dataset.kind) && Number(card.dataset.id) > 0)
      .map((card) => ({ type: card.dataset.kind, id: Number(card.dataset.id) }));

    if (!items.length) return;

    const response = await nativeFetch('/api/dossiers.php?action=reorder', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || 'Tri impossible.');
    toast('Ordre enregistré.', 'success');
  }

  function reorderItem(target) {
    if (!dragged || !target?.card || target.card === dragged.card) return;
    if (target.position === 'before') target.card.parentElement.insertBefore(dragged.card, target.card);
    else target.card.parentElement.insertBefore(dragged.card, target.card.nextSibling);
    return persistOrder();
  }

  function enableCard(card) {
    const item = itemFromCard(card);
    if (!item || card.dataset.moveDragReady === '1') return;
    card.dataset.moveDragReady = '1';
    card.draggable = true;

    card.addEventListener('dragstart', (event) => {
      dragged = itemFromCard(card);
      isDragging = true;
      card.classList.add('is-drag-moving');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `${dragged.type}:${dragged.id}`);
    });

    card.addEventListener('dragend', () => {
      dragged = null;
      isDragging = false;
      resetDropTargets();
    });
  }

  function enableCards() {
    document.querySelectorAll('.dossier-item.folder, .dossier-item.file').forEach(enableCard);
  }

  document.addEventListener('dragover', (event) => {
    if (!isDragging || !dragged) return;
    const target = getTargetFromEvent(event);
    resetDropTargets();

    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (target.mode === 'move') target.card?.classList.add('is-drop-target');
    if (target.mode === 'reorder') target.card?.classList.add(target.position === 'before' ? 'is-drop-before' : 'is-drop-after');
  });

  document.addEventListener('drop', async (event) => {
    if (!isDragging || !dragged) return;
    const target = getTargetFromEvent(event);
    resetDropTargets();

    if (!target) return;
    event.preventDefault();
    event.stopPropagation();

    try {
      if (target.mode === 'move') await moveItem(dragged, target.folderId, target.label);
      if (target.mode === 'reorder') await reorderItem(target);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      dragged = null;
      isDragging = false;
    }
  }, true);

  const observer = new MutationObserver(() => enableCards());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', enableCards);
  enableCards();
})();
