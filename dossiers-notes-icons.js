(() => {
  const iconOptions = [
    { key: 'folder', label: 'Dossier standard', path: '' },
    { key: 'fib', label: 'FIB', path: '/assets/icons/folder-fib.svg' },
    { key: 'crime', label: 'Division Crime', path: '/assets/icons/folder-crime.svg' },
    { key: 'evidence', label: 'Preuves', path: '/assets/icons/folder-evidence.svg' },
    { key: 'report', label: 'Rapports', path: '/assets/icons/folder-report.svg' },
    { key: 'archive', label: 'Archives', path: '/assets/icons/folder-archive.svg' },
  ];

  let lastSelectedFolderId = null;

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

  function currentFolderId() {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('folder_id');
    return value && Number(value) > 0 ? Number(value) : null;
  }

  function selectedFolderCard() {
    return document.querySelector('.dossier-item.folder.is-selected:not(.dossier-back-card)');
  }

  function selectedFolderId() {
    const card = selectedFolderCard();
    const id = Number(card?.dataset?.id || 0);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char]));
  }

  function openModal(title, subtitle, bodyHtml, footerHtml, onReady) {
    const backdrop = document.querySelector('#dossiersModalBackdrop');
    if (!backdrop) return;
    backdrop.hidden = false;
    backdrop.querySelector('#dossiersModalTitle').textContent = title;
    backdrop.querySelector('#dossiersModalSubtitle').textContent = subtitle || '';
    backdrop.querySelector('#dossiersModalBody').innerHTML = bodyHtml;
    backdrop.querySelector('#dossiersModalFooter').innerHTML = footerHtml;
    onReady?.(backdrop);
  }

  function closeModal() {
    const backdrop = document.querySelector('#dossiersModalBackdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function enableNoteMenu() {
    const button = document.querySelector('#dossiersNewMenu [data-action="note"]');
    if (!button || button.dataset.noteReady === '1') return;
    button.disabled = false;
    button.dataset.noteReady = '1';
    const span = button.querySelector('span');
    if (span) span.textContent = 'Créer une note blanche sauvegardée dans ce dossier';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      document.querySelector('#dossiersNewMenu')?.setAttribute('hidden', '');
      openNoteEditor();
    }, true);
  }

  function openNoteEditor() {
    openModal(
      'Nouvelle note',
      'Page blanche sauvegardée dans le dossier actuel.',
      `<form id="dossiersNoteForm" class="dossiers-form dossiers-note-form">
        <label>Titre de la note<input name="title" type="text" maxlength="160" placeholder="Ex : Note d’enquête" required /></label>
        <div class="dossiers-note-toolbar" aria-label="Outils de note">
          <button type="button" data-command="bold"><strong>B</strong></button>
          <button type="button" data-command="italic"><em>I</em></button>
          <button type="button" data-command="insertUnorderedList">• Liste</button>
          <button type="button" data-command="formatBlock" data-value="h3">Titre</button>
          <button type="button" data-command="removeFormat">Nettoyer</button>
        </div>
        <div id="dossiersNoteEditor" class="dossiers-note-editor" contenteditable="true" data-placeholder="Écris ta note ici..."></div>
      </form>`,
      `<button type="button" class="secondary" data-close-modal>Annuler</button><button type="submit" form="dossiersNoteForm" class="primary">Sauvegarder</button>`,
      (backdrop) => {
        const editor = backdrop.querySelector('#dossiersNoteEditor');
        backdrop.querySelectorAll('.dossiers-note-toolbar [data-command]').forEach((button) => {
          button.addEventListener('click', () => {
            editor.focus();
            document.execCommand(button.dataset.command, false, button.dataset.value || null);
          });
        });
        backdrop.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
        backdrop.querySelector('#dossiersNoteForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const title = String(form.get('title') || '').trim();
          const content = editor.innerHTML.trim();
          if (!title) return toast('Titre obligatoire.', 'error');
          if (!editor.textContent.trim()) return toast('La note ne peut pas être vide.', 'error');

          try {
            const response = await fetch('/api/dossiers_extra.php?action=create-note', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, content, folder_id: currentFolderId() }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success === false) throw new Error(payload.message || 'Création de note impossible.');
            closeModal();
            toast('Note sauvegardée.', 'success');
            setTimeout(() => window.location.reload(), 350);
          } catch (error) {
            toast(error.message, 'error');
          }
        });
      }
    );
  }

  function injectIconButton() {
    const card = selectedFolderCard();
    const id = selectedFolderId();
    const footer = document.querySelector('.detail-footer-actions');
    if (!footer || !id) return;
    lastSelectedFolderId = id;

    let button = footer.querySelector('[data-folder-icon-button]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.title = 'Modifier l’icône du dossier';
      button.dataset.folderIconButton = '1';
      button.textContent = '◎';
      footer.insertBefore(button, footer.firstElementChild);
      button.addEventListener('click', () => openIconPicker(lastSelectedFolderId));
    }
    button.hidden = false;
  }

  function hideIconButtonIfNeeded() {
    if (selectedFolderId()) return;
    const button = document.querySelector('[data-folder-icon-button]');
    if (button) button.hidden = true;
  }

  function iconTile(option, selectedKey) {
    const isSelected = option.key === selectedKey;
    const visual = option.path ? `<img src="${escapeHtml(option.path)}" alt="" />` : '<span class="folder-icon"></span>';
    return `<button type="button" class="dossiers-icon-choice ${isSelected ? 'is-selected' : ''}" data-icon-key="${escapeHtml(option.key)}" data-icon-path="${escapeHtml(option.path)}">
      ${visual}<strong>${escapeHtml(option.label)}</strong>
    </button>`;
  }

  function openIconPicker(folderId) {
    if (!folderId) return toast('Sélectionne un dossier.', 'error');
    openModal(
      'Modifier l’icône du dossier',
      'Choisis une icône prédéfinie. Les logos de divisions seront branchés ici plus tard.',
      `<div class="dossiers-icon-grid">${iconOptions.map((option) => iconTile(option, 'folder')).join('')}</div>`,
      `<button type="button" class="secondary" data-close-modal>Annuler</button>`,
      (backdrop) => {
        backdrop.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
        backdrop.querySelector('.dossiers-icon-grid')?.addEventListener('click', async (event) => {
          const choice = event.target.closest('.dossiers-icon-choice');
          if (!choice) return;
          try {
            const response = await fetch('/api/dossiers_extra.php?action=folder-icon', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder_id: folderId, icon_key: choice.dataset.iconKey, icon_path: choice.dataset.iconPath }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success === false) throw new Error(payload.message || 'Icône impossible à modifier.');
            closeModal();
            toast('Icône mise à jour.', 'success');
            setTimeout(() => window.location.reload(), 350);
          } catch (error) {
            toast(error.message, 'error');
          }
        });
      }
    );
  }

  function applyFolderIcons() {
    document.querySelectorAll('.dossier-item.folder:not(.dossier-back-card)').forEach((card) => {
      const existing = card.querySelector('.folder-custom-icon');
      if (existing) return;
      // Les vraies URLs d’icônes arriveront via les colonnes icon_path quand la migration sera appliquée.
      // Pour garder la stabilité, on n’injecte rien si aucune donnée serveur n’est exposée dans la carte.
    });
  }

  function syncSelectionTools() {
    enableNoteMenu();
    applyFolderIcons();
    if (selectedFolderId()) injectIconButton();
    else hideIconButtonIfNeeded();
  }

  const observer = new MutationObserver(syncSelectionTools);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', syncSelectionTools);
  document.addEventListener('click', () => setTimeout(syncSelectionTools, 60));
  syncSelectionTools();
})();
