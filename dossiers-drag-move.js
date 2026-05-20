(() => {
  let dragged = null;
  let isDragging = false;
  const threshold = 6;

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

  function itemFromCard(card) {
    if (!card) return null;
    const kind = card.dataset.kind;
    const id = Number(card.dataset.id);
    if (!['folder', 'file'].includes(kind) || !Number.isFinite(id) || id <= 0) return null;
    return { type: kind, id, card };
  }

  function resetDropTargets() {
    document.querySelectorAll('.is-drop-target, .is-drop-invalid, .is-drag-moving').forEach((node) => {
      node.classList.remove('is-drop-target', 'is-drop-invalid', 'is-drag-moving');
    });
  }

  function getTargetFolderFromEvent(event) {
    const backCard = event.target.closest('.dossier-back-card');
    if (backCard) return { folderId: getParentFolderId(), label: 'dossier parent', card: backCard };

    const folderCard = event.target.closest('.dossier-item.folder');
    if (!folderCard || folderCard === dragged?.card || folderCard.dataset.kind === 'back') return null;

    const id = Number(folderCard.dataset.id);
    if (!Number.isFinite(id) || id <= 0) return null;

    return { folderId: id, label: folderCard.querySelector('strong')?.textContent?.trim() || 'dossier', card: folderCard };
  }

  function getParentFolderId() {
    const breadcrumbButtons = Array.from(document.querySelectorAll('.dossiers-breadcrumb-button'));
    if (breadcrumbButtons.length <= 1) return null;

    const previous = breadcrumbButtons[breadcrumbButtons.length - 2];
    const currentUrl = new URL(window.location.href);
    const before = currentUrl.searchParams.get('folder_id');

    previous.click();

    const afterUrl = new URL(window.location.href);
    const after = afterUrl.searchParams.get('folder_id');

    if (after && Number(after) > 0) {
      window.history.replaceState({}, '', currentUrl.toString());
      return Number(after);
    }

    window.history.replaceState({}, '', currentUrl.toString());
    return null;
  }

  async function moveItem(item, targetFolderId, label) {
    const response = await fetch('/api/dossiers_move.php', {
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
    const target = getTargetFolderFromEvent(event);
    resetDropTargets();

    if (!target) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    target.card?.classList.add('is-drop-target');
  });

  document.addEventListener('drop', async (event) => {
    if (!isDragging || !dragged) return;
    const target = getTargetFolderFromEvent(event);
    resetDropTargets();

    if (!target) return;
    event.preventDefault();
    event.stopPropagation();

    try {
      await moveItem(dragged, target.folderId, target.label);
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
