(() => {
  const initialFolderId = new URLSearchParams(window.location.search).get('folder_id');
  const state = {
    parentId: initialFolderId && Number(initialFolderId) > 0 ? Number(initialFolderId) : null,
    selected: null,
    selectedDetails: null,
    folders: [],
    files: [],
    breadcrumb: [],
    serviceCode: 'MDT',
    view: 'grid',
    quickView: 'all',
    uploadBuffer: [],
  };

  const grid = document.querySelector('#dossiersGrid');
  const searchInput = document.querySelector('#dossiersSearchInput');
  const feedback = document.querySelector('#dossierFeedback');
  const breadcrumbEl = document.querySelector('.dossiers-breadcrumb');
  const newButton = document.querySelector('#newDossierButton');
  const footerButtons = document.querySelectorAll('.detail-footer-actions button');

  const categoryOptions = [
    ['general', 'Général'],
    ['enquete', 'Enquête'],
    ['preuves', 'Preuves'],
    ['rapports', 'Rapports'],
    ['photos', 'Photos'],
    ['videos', 'Vidéos'],
    ['audios', 'Audios'],
    ['administratif', 'Administratif'],
    ['archives', 'Archives'],
    ['confidentiel', 'Confidentiel'],
  ];

  const confidentialityOptions = [
    ['service', 'Service'],
    ['restricted', 'Restreint'],
    ['confidential', 'Confidentiel'],
    ['private', 'Privé'],
  ];

  const permissionOptions = [
    ['view', 'Lecture'],
    ['upload', 'Upload'],
    ['edit', 'Modification'],
    ['delete', 'Suppression'],
    ['restore', 'Restauration'],
    ['download', 'Téléchargement'],
    ['share', 'Partage'],
    ['manage_access', 'Gestion accès'],
    ['archive', 'Archivage'],
    ['owner', 'Propriétaire'],
  ];

  const actionLabels = {
    folder_created: 'a créé le dossier',
    folder_updated: 'a modifié le dossier',
    folder_deleted: 'a envoyé le dossier dans la corbeille',
    folder_restored: 'a restauré le dossier',
    folder_archived: 'a archivé le dossier',
    folder_unarchived: 'a désarchivé le dossier',
    file_uploaded: 'a importé le fichier',
    file_updated: 'a modifié le fichier',
    file_deleted: 'a envoyé le fichier dans la corbeille',
    file_restored: 'a restauré le fichier',
    file_archived: 'a archivé le fichier',
    file_unarchived: 'a désarchivé le fichier',
    file_viewed: 'a consulté le fichier',
    file_downloaded: 'a téléchargé le fichier',
    access_updated: 'a modifié les accès',
    access_removed: 'a retiré un accès',
  };

  function ensureUi() {
    if (document.querySelector('#dossiersUiHost')) return;

    const host = document.createElement('div');
    host.id = 'dossiersUiHost';
    host.innerHTML = `
      <div id="dossiersNewMenu" class="dossiers-new-menu" hidden>
        <button type="button" data-action="folder"><strong>📁 Nouveau dossier</strong><span>Créer un dossier dans l’emplacement actuel</span></button>
        <button type="button" data-action="upload"><strong>⬆ Importer des fichiers</strong><span>Images, PDF, vidéos, audios, documents</span></button>
        <button type="button" data-action="note" disabled><strong>📝 Nouvelle note</strong><span>Prévu dans une prochaine étape</span></button>
      </div>

      <aside id="dossiersDrawer" class="dossiers-drawer" hidden aria-live="polite">
        <header class="dossiers-drawer-header">
          <div><h3 id="dossiersDrawerTitle"></h3><p id="dossiersDrawerSubtitle"></p></div>
          <button type="button" data-close-drawer aria-label="Fermer">×</button>
        </header>
        <div id="dossiersDrawerBody" class="dossiers-drawer-body"></div>
        <footer id="dossiersDrawerFooter" class="dossiers-drawer-footer"></footer>
      </aside>

      <div id="dossiersModalBackdrop" class="dossiers-modal-backdrop" hidden>
        <section id="dossiersModal" class="dossiers-modal" role="dialog" aria-modal="true">
          <header class="dossiers-modal-header">
            <div><h3 id="dossiersModalTitle"></h3><p id="dossiersModalSubtitle"></p></div>
            <button type="button" data-close-modal aria-label="Fermer">×</button>
          </header>
          <div id="dossiersModalBody" class="dossiers-modal-body"></div>
          <footer id="dossiersModalFooter" class="dossiers-modal-footer"></footer>
        </section>
      </div>

      <div id="dossiersConfirmBackdrop" class="dossiers-modal-backdrop" hidden>
        <section class="dossiers-confirm" role="dialog" aria-modal="true">
          <h3 id="dossiersConfirmTitle"></h3>
          <p id="dossiersConfirmText"></p>
          <footer>
            <button type="button" class="secondary" data-confirm-cancel>Annuler</button>
            <button type="button" class="danger" data-confirm-ok>Confirmer</button>
          </footer>
        </section>
      </div>

      <div id="dossiersToast" class="dossiers-toast" hidden></div>
    `;
    document.body.appendChild(host);

    host.querySelector('[data-close-drawer]')?.addEventListener('click', closeDrawer);
    host.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
    host.querySelector('#dossiersModalBackdrop')?.addEventListener('click', (event) => {
      if (event.target.id === 'dossiersModalBackdrop') closeModal();
    });

    host.querySelector('#dossiersNewMenu')?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button || button.disabled) return;
      closeNewMenu();
      if (button.dataset.action === 'folder') openFolderDrawer();
      if (button.dataset.action === 'upload') openUploadModal();
      if (button.dataset.action === 'note') setFeedback('Les notes texte seront ajoutées plus tard.');
    });

    document.addEventListener('click', (event) => {
      const menu = document.querySelector('#dossiersNewMenu');
      if (!menu || menu.hidden) return;
      if (menu.contains(event.target) || newButton?.contains(event.target)) return;
      closeNewMenu();
    });
  }

  function showToast(message, type = 'info') {
    ensureUi();
    const toast = document.querySelector('#dossiersToast');
    if (!toast || !message) return;
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => { toast.hidden = true; }, type === 'error' ? 5200 : 3600);
  }

  function setFeedback(message, type = 'info') {
    if (feedback) {
      feedback.textContent = message || '';
      feedback.dataset.type = type;
    }
    if (message) showToast(message, type);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function optionHtml(options, selectedValue) {
    return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (state.parentId && state.quickView === 'all') url.searchParams.set('folder_id', String(state.parentId));
    else url.searchParams.delete('folder_id');
    window.history.replaceState({ folder_id: state.parentId }, '', url.toString());
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatSize(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} o`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
    return `${(value / 1024 / 1024).toFixed(1)} Mo`;
  }

  function confidentialityLabel(value) {
    return { private: 'Privé', service: 'Service', restricted: 'Restreint', confidential: 'Confidentiel' }[value] || 'Service';
  }

  function fileTypeLabel(extension) {
    return String(extension || 'file').toUpperCase().slice(0, 5);
  }

  function permissionLabel(value) {
    return Object.fromEntries(permissionOptions)[value] || value;
  }

  function renderChips(container, values) {
    if (!container) return;
    container.innerHTML = '';
    values.forEach((value) => {
      const chip = document.createElement('span');
      chip.textContent = value;
      container.appendChild(chip);
    });
  }

  async function requestJson(url, options = {}) {
    const headers = options.body instanceof FormData ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const response = await fetch(url, { credentials: 'same-origin', headers, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || 'Erreur de communication avec le serveur.');
    return payload;
  }

  function folderToDetail(folder) {
    return {
      type: 'folder', id: Number(folder.id), title: folder.name || 'Dossier sans nom',
      subtype: folder.category && folder.category !== 'general' ? folder.category : 'Dossier',
      badge: confidentialityLabel(folder.confidentiality_level), description: folder.description || 'Aucune description renseignée pour ce dossier.',
      owner: folder.owner_username || 'Non défini', service: folder.service_code || state.serviceCode,
      created: formatDate(folder.created_at), updated: formatDate(folder.updated_at), deletedAt: folder.deleted_at || null,
      tags: [folder.category || 'general', folder.status || 'active', confidentialityLabel(folder.confidentiality_level)],
      linked: folder.parent_id ? `Dossier parent #${folder.parent_id}` : 'Racine du service',
      activity: ['Chargement de l’activité...'], access: ['Chargement des accès...'],
      foldersCount: Number(folder.folders_count || 0), filesCount: Number(folder.files_count || 0), isFavorite: Boolean(Number(folder.is_favorite || 0)), raw: folder,
    };
  }

  function fileToDetail(file) {
    const ext = fileTypeLabel(file.extension);
    return {
      type: 'file', id: Number(file.id), title: file.original_name || 'Fichier sans nom', subtype: file.mime_type || 'Fichier', badge: ext,
      description: file.description || 'Aucune description renseignée pour ce fichier.', owner: file.owner_username || 'Non défini', service: file.service_code || state.serviceCode,
      created: formatDate(file.created_at), updated: formatDate(file.updated_at), deletedAt: file.deleted_at || null,
      tags: [ext, file.status || 'active', confidentialityLabel(file.confidentiality_level)],
      linked: file.folder_id ? `Dossier #${file.folder_id}` : 'Racine du service',
      activity: ['Chargement de l’activité...'], access: ['Chargement des accès...'],
      size: formatSize(file.size_bytes), extension: ext, isFavorite: Boolean(Number(file.is_favorite || 0)), raw: file,
    };
  }

  async function fetchItemDetails(data = state.selected) {
    if (!data) return null;
    const payload = await requestJson(`/api/dossiers.php?action=get&type=${data.type}&id=${data.id}`);
    state.selectedDetails = payload;
    return payload;
  }

  async function loadDetails(data) {
    try {
      const payload = await fetchItemDetails(data);
      const tags = Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : data.tags;
      const logs = (payload.logs || []).map((log) => {
        const action = actionLabels[log.action] || log.action;
        return `${formatDate(log.created_at)} · ${log.created_by_username || 'Système'} ${action}`;
      });
      const permissions = (payload.permissions || []).map((p) => `${p.subject_type}:${p.subject_value} · ${permissionLabel(p.permission)}`);
      if (state.selected && state.selected.type === data.type && state.selected.id === data.id) {
        renderChips(document.querySelector('#detailTags'), tags);
        renderChips(document.querySelector('#detailActivity'), logs.length ? logs : ['Aucune activité enregistrée.']);
        renderChips(document.querySelector('#detailAccess'), permissions.length ? permissions : [`Niveau : ${data.badge}`, `Service : ${data.service}`]);
      }
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  }

  function selectItem(item) {
    const data = item || null;
    state.selected = data;
    state.selectedDetails = null;
    document.querySelectorAll('.dossier-item').forEach((card) => card.classList.toggle('is-selected', data && card.dataset.id === String(data.id) && card.dataset.kind === data.type));

    if (!data) {
      document.querySelector('#detailTitle').textContent = 'Aucun élément sélectionné';
      document.querySelector('#detailSubtype').textContent = 'Sélection';
      document.querySelector('#detailBadge').textContent = '—';
      document.querySelector('#detailDescription').textContent = 'Sélectionne un dossier ou fichier pour afficher ses informations.';
      document.querySelector('#detailOwner').textContent = '—';
      document.querySelector('#detailService').textContent = state.serviceCode;
      document.querySelector('#detailCreated').textContent = '—';
      document.querySelector('#detailUpdated').textContent = '—';
      document.querySelector('#detailLinked').textContent = '—';
      document.querySelector('#favoriteButton').textContent = '☆';
      renderChips(document.querySelector('#detailTags'), []);
      renderChips(document.querySelector('#detailActivity'), []);
      renderChips(document.querySelector('#detailAccess'), []);
      updateActionButtons();
      return;
    }

    document.querySelector('#detailTitle').textContent = data.title;
    document.querySelector('#detailSubtype').textContent = data.type === 'file' && data.size ? `${data.subtype} · ${data.size}` : data.subtype;
    document.querySelector('#detailBadge').textContent = state.quickView === 'trash' ? 'Supprimé' : data.badge;
    document.querySelector('#detailDescription').textContent = data.description;
    document.querySelector('#detailOwner').textContent = data.owner;
    document.querySelector('#detailService').textContent = data.service;
    document.querySelector('#detailCreated').textContent = data.created;
    document.querySelector('#detailUpdated').textContent = data.updated;
    document.querySelector('#detailLinked').textContent = data.linked;
    document.querySelector('#detailIcon').className = data.type === 'folder' ? 'folder-icon' : 'file-detail-icon';
    document.querySelector('#favoriteButton').textContent = data.isFavorite ? '★' : '☆';
    renderChips(document.querySelector('#detailTags'), data.tags);
    renderChips(document.querySelector('#detailActivity'), data.activity);
    renderChips(document.querySelector('#detailAccess'), data.access);
    updateActionButtons();
    loadDetails(data);
  }

  function updateActionButtons() {
    const hasSelected = Boolean(state.selected);
    footerButtons.forEach((button) => { button.disabled = !hasSelected; });
    if (!footerButtons.length) return;

    footerButtons[0].textContent = '↗'; footerButtons[0].title = 'Partager / gérer les accès';
    footerButtons[1].textContent = '✎'; footerButtons[1].title = 'Modifier';
    footerButtons[2].textContent = '⇩'; footerButtons[2].title = 'Télécharger';
    footerButtons[2].disabled = !hasSelected || state.selected?.type !== 'file' || state.quickView === 'trash';

    if (state.quickView === 'trash') {
      footerButtons[3].textContent = '↩'; footerButtons[3].title = 'Restaurer';
      footerButtons[4].textContent = '⌫'; footerButtons[4].title = 'Supprimer définitivement';
      footerButtons[4].classList.add('danger');
      return;
    }

    if (state.quickView === 'archive' || state.selected?.raw?.status === 'archived') {
      footerButtons[3].textContent = '↩'; footerButtons[3].title = 'Désarchiver';
      footerButtons[4].textContent = '⌫'; footerButtons[4].title = 'Envoyer à la corbeille';
      return;
    }

    footerButtons[3].textContent = '▣'; footerButtons[3].title = 'Archiver';
    footerButtons[4].textContent = '⌫'; footerButtons[4].title = 'Envoyer à la corbeille';
  }

  function createFolderCard(folder) {
    const detail = folderToDetail(folder);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `dossier-item folder ${folder.deleted_at ? 'is-deleted' : ''} ${folder.status === 'archived' ? 'is-archived' : ''}`;
    card.dataset.id = String(detail.id);
    card.dataset.kind = 'folder';
    card.dataset.search = `${detail.title} ${detail.description} ${detail.tags.join(' ')}`;
    card.title = 'Double-clique pour ouvrir ce dossier';
    const fav = detail.isFavorite ? ' ★' : '';
    const folders = detail.foldersCount > 0 ? `${detail.foldersCount} dossier${detail.foldersCount > 1 ? 's' : ''}` : '';
    const files = detail.filesCount > 0 ? `${detail.filesCount} fichier${detail.filesCount > 1 ? 's' : ''}` : '';
    const status = folder.deleted_at ? 'Supprimé' : folder.status === 'archived' ? 'Archivé' : '';
    const meta = [folders, files, status].filter(Boolean).join(' · ') || confidentialityLabel(folder.confidentiality_level);
    card.innerHTML = `<span class="item-menu">⋮</span><span class="folder-icon"></span><strong>${escapeHtml(detail.title)}${fav}</strong><small>${escapeHtml(meta)}</small>`;
    card.addEventListener('click', () => selectItem(detail));
    card.addEventListener('dblclick', () => {
      if (state.quickView !== 'trash') openFolder(detail.id);
    });
    return card;
  }

  function previewClass(extension) {
    const ext = String(extension || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image-preview';
    if (['mp4', 'webm'].includes(ext)) return 'video-preview';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio-preview';
    if (ext === 'pdf') return 'pdf-preview';
    return 'txt-preview';
  }

  function createFileCard(file) {
    const detail = fileToDetail(file);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `dossier-item file ${file.deleted_at ? 'is-deleted' : ''} ${file.status === 'archived' ? 'is-archived' : ''}`;
    card.dataset.id = String(detail.id);
    card.dataset.kind = 'file';
    card.dataset.search = `${detail.title} ${detail.description} ${detail.tags.join(' ')}`;
    const preview = previewClass(file.extension);
    const previewInner = preview === 'video-preview' ? '<i>▶</i>' : preview === 'audio-preview' ? '<i></i>' : `<span>${detail.extension}</span>`;
    const status = file.deleted_at ? 'Supprimé' : file.status === 'archived' ? 'Archivé' : '';
    card.innerHTML = `<span class="item-menu">⋮</span><span class="file-preview ${preview}">${previewInner}</span><strong>${escapeHtml(detail.title)}${detail.isFavorite ? ' ★' : ''}</strong><small>${escapeHtml(detail.size)} · ${escapeHtml(formatDate(file.created_at).split(' à ')[0])}${status ? ' · ' + escapeHtml(status) : ''}</small><span class="file-badge ${String(file.extension || '').toLowerCase()}">${escapeHtml(detail.extension)}</span>`;
    card.addEventListener('click', () => selectItem(detail));
    card.addEventListener('dblclick', () => downloadSelected(detail));
    return card;
  }

  function renderBreadcrumb() {
    if (!breadcrumbEl) return;
    breadcrumbEl.innerHTML = '';
    const root = document.createElement('button');
    root.type = 'button';
    root.className = 'dossiers-breadcrumb-button';
    root.textContent = state.quickView === 'all' ? state.serviceCode : viewTitle();
    root.title = 'Retourner à la racine du service';
    root.addEventListener('click', () => openFolder(null));
    breadcrumbEl.appendChild(root);

    if (state.quickView !== 'all') return;
    state.breadcrumb.forEach((item) => {
      const sep = document.createElement('span'); sep.textContent = '›';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'dossiers-breadcrumb-button'; button.textContent = item.name; button.addEventListener('click', () => openFolder(Number(item.id)));
      breadcrumbEl.append(sep, button);
    });
  }

  function viewTitle() {
    return { shared: 'Partagés avec moi', recent: 'Récents', favorite: 'Favoris', archive: 'Archives', trash: 'Corbeille' }[state.quickView] || state.serviceCode;
  }

  function renderBackCard() {
    if (state.parentId === null || state.quickView !== 'all') return null;
    const parent = state.breadcrumb.length >= 2 ? Number(state.breadcrumb[state.breadcrumb.length - 2].id) : null;
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'dossier-item folder dossier-back-card'; back.dataset.kind = 'back'; back.title = 'Double-clique pour retourner au dossier parent';
    back.innerHTML = '<span class="folder-icon"></span><strong>Retour</strong><small>Double-clique pour revenir</small>';
    back.addEventListener('click', () => { document.querySelectorAll('.dossier-item').forEach((card) => card.classList.remove('is-selected')); back.classList.add('is-selected'); setFeedback('Double-clique sur “Retour” pour ouvrir le dossier parent.'); });
    back.addEventListener('dblclick', () => openFolder(parent));
    return back;
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = '';
    grid.dataset.view = state.view;
    const backCard = renderBackCard(); if (backCard) grid.appendChild(backCard);
    state.folders.forEach((folder) => grid.appendChild(createFolderCard(folder)));
    state.files.forEach((file) => grid.appendChild(createFileCard(file)));
    if (state.folders.length === 0 && state.files.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dossiers-empty-state';
      empty.innerHTML = `<strong>Aucun élément ici.</strong><span>${state.quickView === 'all' ? 'Utilise “+ Nouveau” pour créer un dossier ou importer un fichier.' : 'Cette vue ne contient aucun élément.'}</span>`;
      grid.appendChild(empty);
      selectItem(null);
      return;
    }
    if (state.folders.length > 0) selectItem(folderToDetail(state.folders[0]));
    else if (state.files.length > 0) selectItem(fileToDetail(state.files[0]));
    else selectItem(null);
  }

  async function loadFolders() {
    const params = new URLSearchParams();
    params.set('action', 'list');
    params.set('view', state.quickView);
    if (state.parentId !== null && state.quickView === 'all') params.set('parent_id', String(state.parentId));
    const query = searchInput?.value.trim() || ''; if (query !== '') params.set('q', query);
    grid.innerHTML = '<div class="dossiers-empty-state"><strong>Chargement...</strong><span>Récupération des éléments du service.</span></div>';
    const payload = await requestJson(`/api/dossiers.php?${params.toString()}`);
    state.serviceCode = payload.service_code || state.serviceCode;
    state.folders = Array.isArray(payload.folders) ? payload.folders : [];
    state.files = Array.isArray(payload.files) ? payload.files : [];
    state.breadcrumb = Array.isArray(payload.breadcrumb) ? payload.breadcrumb : [];
    renderBreadcrumb();
    renderGrid();
    updateUrl();
    setFeedback('');
  }

  async function openFolder(id) {
    state.quickView = 'all';
    document.querySelectorAll('.dossiers-quick-card').forEach((card) => card.classList.toggle('is-active', card.dataset.filter === 'all'));
    state.parentId = id === null || id === undefined ? null : Number(id);
    await loadFolders().catch((error) => setFeedback(error.message, 'error'));
  }

  function toggleNewMenu() {
    ensureUi();
    const menu = document.querySelector('#dossiersNewMenu');
    if (!menu || !newButton) return;
    if (!menu.hidden) {
      closeNewMenu();
      return;
    }
    const rect = newButton.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${Math.max(16, rect.right - 310)}px`;
    menu.hidden = false;
  }

  function closeNewMenu() {
    document.querySelector('#dossiersNewMenu')?.setAttribute('hidden', '');
  }

  function openDrawer(title, subtitle, bodyHtml, footerHtml, onReady) {
    ensureUi();
    const drawer = document.querySelector('#dossiersDrawer');
    document.querySelector('#dossiersDrawerTitle').textContent = title;
    document.querySelector('#dossiersDrawerSubtitle').textContent = subtitle || '';
    document.querySelector('#dossiersDrawerBody').innerHTML = bodyHtml;
    document.querySelector('#dossiersDrawerFooter').innerHTML = footerHtml || '';
    drawer.hidden = false;
    if (typeof onReady === 'function') onReady(drawer);
  }

  function closeDrawer() {
    const drawer = document.querySelector('#dossiersDrawer');
    if (drawer) drawer.hidden = true;
  }

  function openModal(title, subtitle, bodyHtml, footerHtml, onReady) {
    ensureUi();
    const backdrop = document.querySelector('#dossiersModalBackdrop');
    document.querySelector('#dossiersModalTitle').textContent = title;
    document.querySelector('#dossiersModalSubtitle').textContent = subtitle || '';
    document.querySelector('#dossiersModalBody').innerHTML = bodyHtml;
    document.querySelector('#dossiersModalFooter').innerHTML = footerHtml || '';
    backdrop.hidden = false;
    if (typeof onReady === 'function') onReady(backdrop);
  }

  function closeModal() {
    const backdrop = document.querySelector('#dossiersModalBackdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function openConfirm({ title, text, confirmText = 'Confirmer', danger = true, onConfirm }) {
    ensureUi();
    const backdrop = document.querySelector('#dossiersConfirmBackdrop');
    backdrop.hidden = false;
    backdrop.querySelector('#dossiersConfirmTitle').textContent = title;
    backdrop.querySelector('#dossiersConfirmText').textContent = text;
    const ok = backdrop.querySelector('[data-confirm-ok]');
    ok.textContent = confirmText;
    ok.classList.toggle('danger', danger);
    const cancel = backdrop.querySelector('[data-confirm-cancel]');
    const close = () => { backdrop.hidden = true; ok.onclick = null; cancel.onclick = null; };
    cancel.onclick = close;
    ok.onclick = async () => {
      close();
      await onConfirm?.();
    };
  }

  function currentLocationLabel() {
    if (state.quickView !== 'all') return viewTitle();
    const parts = [state.serviceCode, ...state.breadcrumb.map((item) => item.name)];
    return parts.join(' > ');
  }

  function openFolderDrawer() {
    openDrawer(
      'Nouveau dossier',
      `Créer dans : ${currentLocationLabel()}`,
      `<form id="folderCreateForm" class="dossiers-form">
        <label>Nom du dossier<input name="name" type="text" placeholder="Ex : Preuves" required maxlength="140" /></label>
        <label>Description<textarea name="description" rows="4" placeholder="Description optionnelle du dossier"></textarea></label>
        <label>Catégorie<select name="category">${optionHtml(categoryOptions, 'general')}</select></label>
        <label>Confidentialité<select name="confidentiality_level">${optionHtml(confidentialityOptions, 'service')}</select></label>
        <label>Tags<input name="tags" type="text" placeholder="preuve, enquête, confidentiel" /></label>
      </form>`,
      `<button type="button" class="secondary" data-close-drawer>Annuler</button><button type="submit" form="folderCreateForm" class="primary">Créer dossier</button>`,
      (drawer) => {
        drawer.querySelector('[data-close-drawer]')?.addEventListener('click', closeDrawer);
        drawer.querySelector('#folderCreateForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload = {
            name: String(form.get('name') || '').trim(),
            description: String(form.get('description') || '').trim(),
            category: String(form.get('category') || 'general'),
            confidentiality_level: String(form.get('confidentiality_level') || 'service'),
            tags: String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
            parent_id: state.quickView === 'all' ? state.parentId : null,
          };
          if (!payload.name) return setFeedback('Nom du dossier obligatoire.', 'error');
          try {
            setFeedback('Création du dossier en cours...');
            const result = await requestJson('/api/dossiers.php?action=create-folder', { method: 'POST', body: JSON.stringify(payload) });
            closeDrawer();
            await loadFolders();
            if (result.folder) selectItem(folderToDetail(result.folder));
            setFeedback('Dossier créé avec succès.', 'success');
          } catch (error) {
            setFeedback(error.message, 'error');
          }
        });
      }
    );
  }

  function openUploadModal() {
    state.uploadBuffer = [];
    openModal(
      'Importer des fichiers',
      `Destination : ${currentLocationLabel()}`,
      `<form id="uploadForm" class="dossiers-form">
        <div id="uploadDropzone" class="dossiers-dropzone">
          <strong>⬆ Glissez vos fichiers ici</strong>
          <span>ou cliquez pour parcourir · JPG, PNG, PDF, MP4, MP3, TXT · max 50 Mo</span>
          <input id="uploadFileInput" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.doc,.docx,.mp4,.webm,.mp3,.wav,.ogg,.zip" hidden />
        </div>
        <div id="uploadFileList" class="dossiers-upload-list"><span>Aucun fichier sélectionné.</span></div>
        <label>Description commune<textarea name="description" rows="3" placeholder="Description optionnelle"></textarea></label>
        <label>Confidentialité<select name="confidentiality_level">${optionHtml(confidentialityOptions, 'service')}</select></label>
        <label>Tags communs<input name="tags" type="text" placeholder="preuve, vidéo, rapport" /></label>
      </form>`,
      `<button type="button" class="secondary" data-close-modal>Annuler</button><button type="submit" form="uploadForm" class="primary">Importer</button>`,
      (backdrop) => {
        backdrop.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
        const input = backdrop.querySelector('#uploadFileInput');
        const dropzone = backdrop.querySelector('#uploadDropzone');
        const list = backdrop.querySelector('#uploadFileList');
        const renderList = () => {
          if (!state.uploadBuffer.length) {
            list.innerHTML = '<span>Aucun fichier sélectionné.</span>';
            return;
          }
          list.innerHTML = state.uploadBuffer.map((file, index) => `<div><span>${escapeHtml(file.name)}</span><small>${formatSize(file.size)}</small><button type="button" data-remove-file="${index}">×</button></div>`).join('');
        };
        dropzone.addEventListener('click', () => input.click());
        dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
        dropzone.addEventListener('drop', (event) => {
          event.preventDefault();
          dropzone.classList.remove('is-dragging');
          state.uploadBuffer = Array.from(event.dataTransfer.files || []);
          renderList();
        });
        input.addEventListener('change', () => {
          state.uploadBuffer = Array.from(input.files || []);
          renderList();
        });
        list.addEventListener('click', (event) => {
          const button = event.target.closest('[data-remove-file]');
          if (!button) return;
          state.uploadBuffer.splice(Number(button.dataset.removeFile), 1);
          renderList();
        });
        backdrop.querySelector('#uploadForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          if (!state.uploadBuffer.length) return setFeedback('Sélectionne au moins un fichier.', 'error');
          const form = new FormData(event.currentTarget);
          const uploadData = new FormData();
          state.uploadBuffer.forEach((file) => uploadData.append('files[]', file));
          if (state.parentId && state.quickView === 'all') uploadData.append('folder_id', String(state.parentId));
          uploadData.append('description', String(form.get('description') || ''));
          uploadData.append('confidentiality_level', String(form.get('confidentiality_level') || 'service'));
          uploadData.append('tags', String(form.get('tags') || ''));
          try {
            setFeedback('Import en cours...');
            await requestJson('/api/dossiers.php?action=upload-file', { method: 'POST', body: uploadData });
            closeModal();
            await loadFolders();
            setFeedback('Fichier importé avec succès.', 'success');
          } catch (error) {
            setFeedback(error.message, 'error');
          }
        });
      }
    );
  }

  function openEditDrawer() {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    const raw = state.selected.raw || {};
    const existingTags = state.selectedDetails?.tags?.length ? state.selectedDetails.tags.join(', ') : state.selected.tags.join(', ');
    openDrawer(
      state.selected.type === 'folder' ? 'Modifier le dossier' : 'Modifier le fichier',
      state.selected.title,
      `<form id="editForm" class="dossiers-form">
        <label>Nom<input name="name" type="text" required maxlength="180" value="${escapeHtml(state.selected.title)}" /></label>
        <label>Description<textarea name="description" rows="4">${escapeHtml(state.selected.description === 'Aucune description renseignée pour ce fichier.' || state.selected.description === 'Aucune description renseignée pour ce dossier.' ? '' : state.selected.description)}</textarea></label>
        ${state.selected.type === 'folder' ? `<label>Catégorie<select name="category">${optionHtml(categoryOptions, raw.category || 'general')}</select></label>` : ''}
        <label>Confidentialité<select name="confidentiality_level">${optionHtml(confidentialityOptions, raw.confidentiality_level || 'service')}</select></label>
        <label>Tags<input name="tags" type="text" value="${escapeHtml(existingTags)}" /></label>
        ${state.selected.type === 'file' ? `<div class="dossiers-readonly-box"><span>Type : ${escapeHtml(state.selected.extension)}</span><span>Taille : ${escapeHtml(state.selected.size)}</span><span>Uploadé par : ${escapeHtml(state.selected.owner)}</span></div>` : ''}
      </form>`,
      `<button type="button" class="secondary" data-close-drawer>Annuler</button><button type="submit" form="editForm" class="primary">Enregistrer</button>`,
      (drawer) => {
        drawer.querySelector('[data-close-drawer]')?.addEventListener('click', closeDrawer);
        drawer.querySelector('#editForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload = {
            type: state.selected.type,
            id: state.selected.id,
            name: String(form.get('name') || '').trim(),
            description: String(form.get('description') || '').trim(),
            category: String(form.get('category') || raw.category || 'general'),
            confidentiality_level: String(form.get('confidentiality_level') || 'service'),
            tags: String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
          };
          if (!payload.name) return setFeedback('Nom obligatoire.', 'error');
          try {
            await requestJson('/api/dossiers.php?action=update', { method: 'POST', body: JSON.stringify(payload) });
            closeDrawer();
            await loadFolders();
            setFeedback('Élément modifié.', 'success');
          } catch (error) {
            setFeedback(error.message, 'error');
          }
        });
      }
    );
  }

  async function openAccessDrawer() {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    openDrawer('Gérer les accès', state.selected.title, '<div class="dossiers-empty-state compact"><strong>Chargement...</strong><span>Récupération des permissions.</span></div>', '', null);
    try {
      const payload = await fetchItemDetails();
      renderAccessDrawer(payload.permissions || []);
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  }

  function renderAccessDrawer(permissions) {
    const listHtml = permissions.length
      ? permissions.map((p) => `<div class="dossiers-permission-row"><span>${escapeHtml(p.subject_type)}:${escapeHtml(p.subject_value)}</span><strong>${escapeHtml(permissionLabel(p.permission))}</strong><button type="button" data-remove-permission="${p.id}">Retirer</button></div>`).join('')
      : '<div class="dossiers-empty-inline">Aucun accès personnalisé.</div>';

    openDrawer(
      'Gérer les accès',
      state.selected.title,
      `<div class="dossiers-permissions-list">${listHtml}</div>
      <form id="accessForm" class="dossiers-form access-form">
        <label>Type de cible<select name="subject_type"><option value="service">Service</option><option value="user">Agent ID</option><option value="rank">Grade</option></select></label>
        <label>Cible<input name="subject_value" type="text" value="${escapeHtml(state.serviceCode)}" required /></label>
        <label>Permission<select name="permission">${optionHtml(permissionOptions, 'view')}</select></label>
        <label>Expiration optionnelle<input name="expires_at" type="datetime-local" /></label>
      </form>`,
      `<button type="button" class="secondary" data-close-drawer>Fermer</button><button type="submit" form="accessForm" class="primary">Ajouter accès</button>`,
      (drawer) => {
        drawer.querySelector('[data-close-drawer]')?.addEventListener('click', closeDrawer);
        drawer.querySelector('.dossiers-permissions-list')?.addEventListener('click', async (event) => {
          const button = event.target.closest('[data-remove-permission]');
          if (!button) return;
          try {
            const result = await requestJson('/api/dossiers.php?action=remove-permission', {
              method: 'POST',
              body: JSON.stringify({ type: state.selected.type, id: state.selected.id, permission_id: Number(button.dataset.removePermission) }),
            });
            renderAccessDrawer(result.permissions || []);
            await loadDetails(state.selected);
            setFeedback('Accès retiré.', 'success');
          } catch (error) {
            setFeedback(error.message, 'error');
          }
        });
        drawer.querySelector('#accessForm')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            const result = await requestJson('/api/dossiers.php?action=permission', {
              method: 'POST',
              body: JSON.stringify({
                type: state.selected.type,
                id: state.selected.id,
                subject_type: String(form.get('subject_type') || 'service'),
                subject_value: String(form.get('subject_value') || state.serviceCode).trim(),
                permission: String(form.get('permission') || 'view'),
                expires_at: String(form.get('expires_at') || ''),
              }),
            });
            renderAccessDrawer(result.permissions || []);
            await loadDetails(state.selected);
            setFeedback('Accès ajouté.', 'success');
          } catch (error) {
            setFeedback(error.message, 'error');
          }
        });
      }
    );
  }

  async function runAction(action, successMessage) {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    try {
      await requestJson(`/api/dossiers.php?action=${action}`, {
        method: 'POST',
        body: JSON.stringify({ type: state.selected.type, id: state.selected.id }),
      });
      await loadFolders();
      setFeedback(successMessage, 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  }

  function confirmAction(action) {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    const name = state.selected.title;
    const config = {
      delete: { title: 'Envoyer à la corbeille ?', text: `“${name}” sera déplacé dans la corbeille.`, confirmText: 'Supprimer', danger: true, success: 'Élément envoyé dans la corbeille.' },
      restore: { title: 'Restaurer cet élément ?', text: `“${name}” sera restauré dans son emplacement d’origine.`, confirmText: 'Restaurer', danger: false, success: 'Élément restauré.' },
      archive: { title: 'Archiver cet élément ?', text: `“${name}” ne sera plus visible dans les dossiers actifs.`, confirmText: 'Archiver', danger: false, success: 'Élément archivé.' },
      unarchive: { title: 'Désarchiver cet élément ?', text: `“${name}” redeviendra actif.`, confirmText: 'Désarchiver', danger: false, success: 'Élément désarchivé.' },
      'permanent-delete': { title: 'Suppression définitive', text: `Cette action est définitive. “${name}” sera supprimé du serveur et de la base.`, confirmText: 'Supprimer définitivement', danger: true, success: 'Élément supprimé définitivement.' },
    }[action];
    openConfirm({ ...config, onConfirm: () => runAction(action, config.success) });
  }

  async function toggleFavorite() {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    const enabled = !state.selected.isFavorite;
    try {
      await requestJson('/api/dossiers.php?action=favorite', { method: 'POST', body: JSON.stringify({ type: state.selected.type, id: state.selected.id, enabled }) });
      state.selected.isFavorite = enabled;
      document.querySelector('#favoriteButton').textContent = enabled ? '★' : '☆';
      await loadFolders();
      setFeedback(enabled ? 'Ajouté aux favoris.' : 'Retiré des favoris.', 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  }

  function downloadSelected(data = state.selected) {
    if (!data || data.type !== 'file') return setFeedback('Sélectionne un fichier à télécharger.', 'error');
    if (state.quickView === 'trash') return setFeedback('Restaure le fichier avant de le télécharger.', 'error');
    window.open(`/api/dossiers.php?action=download&id=${data.id}`, '_blank');
  }

  document.querySelectorAll('.detail-tabs button').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.detail-tabs button').forEach((button) => button.classList.toggle('is-active', button === tab));
    document.querySelectorAll('.detail-tab-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab));
  }));

  document.querySelectorAll('.dossiers-view-toggle button').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.dossiers-view-toggle button').forEach((current) => current.classList.toggle('is-active', current === button));
    state.view = button.dataset.view || 'grid';
    grid.dataset.view = state.view;
  }));

  document.querySelectorAll('.dossiers-quick-card').forEach((card) => card.addEventListener('click', () => {
    document.querySelectorAll('.dossiers-quick-card').forEach((current) => current.classList.toggle('is-active', current === card));
    state.quickView = card.dataset.filter || 'all';
    if (state.quickView !== 'all') state.parentId = null;
    loadFolders().catch((error) => setFeedback(error.message, 'error'));
  }));

  let searchTimeout = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadFolders().catch((error) => setFeedback(error.message, 'error')), 250);
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === 'Escape') {
      closeNewMenu();
      closeDrawer();
      closeModal();
    }
  });

  newButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleNewMenu();
  });
  document.querySelector('#manageAccessButton')?.addEventListener('click', openAccessDrawer);
  document.querySelector('#favoriteButton')?.addEventListener('click', toggleFavorite);

  footerButtons[0]?.addEventListener('click', openAccessDrawer);
  footerButtons[1]?.addEventListener('click', openEditDrawer);
  footerButtons[2]?.addEventListener('click', () => downloadSelected());
  footerButtons[3]?.addEventListener('click', () => {
    if (state.quickView === 'trash') return confirmAction('restore');
    if (state.quickView === 'archive' || state.selected?.raw?.status === 'archived') return confirmAction('unarchive');
    return confirmAction('archive');
  });
  footerButtons[4]?.addEventListener('click', () => {
    if (state.quickView === 'trash') return confirmAction('permanent-delete');
    return confirmAction('delete');
  });

  window.addEventListener('popstate', () => {
    const folderId = new URLSearchParams(window.location.search).get('folder_id');
    state.parentId = folderId && Number(folderId) > 0 ? Number(folderId) : null;
    loadFolders().catch((error) => setFeedback(error.message, 'error'));
  });

  ensureUi();
  loadFolders().catch((error) => {
    setFeedback(error.message, 'error');
    grid.innerHTML = '<div class="dossiers-empty-state"><strong>Module dossiers non initialisé.</strong><span>Vérifie que les migrations SQL 023 et 024 ont bien été exécutées.</span></div>';
    selectItem(null);
  });
})();
