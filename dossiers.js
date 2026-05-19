(() => {
  const initialFolderId = new URLSearchParams(window.location.search).get('folder_id');
  const state = {
    parentId: initialFolderId && Number(initialFolderId) > 0 ? Number(initialFolderId) : null,
    selected: null,
    folders: [],
    files: [],
    breadcrumb: [],
    serviceCode: 'MDT',
    view: 'grid',
    quickView: 'all',
  };

  const grid = document.querySelector('#dossiersGrid');
  const searchInput = document.querySelector('#dossiersSearchInput');
  const feedback = document.querySelector('#dossierFeedback');
  const breadcrumbEl = document.querySelector('.dossiers-breadcrumb');
  let uploadInput = null;

  function setFeedback(message, type = 'info') {
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.dataset.type = type;
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
      created: formatDate(folder.created_at), updated: formatDate(folder.updated_at),
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
      created: formatDate(file.created_at), updated: formatDate(file.updated_at),
      tags: [ext, file.status || 'active', confidentialityLabel(file.confidentiality_level)],
      linked: file.folder_id ? `Dossier #${file.folder_id}` : 'Racine du service',
      activity: ['Chargement de l’activité...'], access: ['Chargement des accès...'],
      size: formatSize(file.size_bytes), extension: ext, isFavorite: Boolean(Number(file.is_favorite || 0)), raw: file,
    };
  }

  async function loadDetails(data) {
    try {
      const payload = await requestJson(`/api/dossiers.php?action=get&type=${data.type}&id=${data.id}`);
      const tags = Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : data.tags;
      const logs = (payload.logs || []).map((log) => `${formatDate(log.created_at)} · ${log.created_by_username || 'Système'} · ${log.action}`);
      const permissions = (payload.permissions || []).map((p) => `${p.subject_type}:${p.subject_value} · ${p.permission}`);
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
      renderChips(document.querySelector('#detailTags'), []); renderChips(document.querySelector('#detailActivity'), []); renderChips(document.querySelector('#detailAccess'), []);
      return;
    }

    document.querySelector('#detailTitle').textContent = data.title;
    document.querySelector('#detailSubtype').textContent = data.type === 'file' && data.size ? `${data.subtype} · ${data.size}` : data.subtype;
    document.querySelector('#detailBadge').textContent = data.badge;
    document.querySelector('#detailDescription').textContent = data.description;
    document.querySelector('#detailOwner').textContent = data.owner;
    document.querySelector('#detailService').textContent = data.service;
    document.querySelector('#detailCreated').textContent = data.created;
    document.querySelector('#detailUpdated').textContent = data.updated;
    document.querySelector('#detailLinked').textContent = data.linked;
    document.querySelector('#detailIcon').className = data.type === 'folder' ? 'folder-icon' : 'file-detail-icon';
    document.querySelector('#favoriteButton').textContent = data.isFavorite ? '★' : '☆';
    renderChips(document.querySelector('#detailTags'), data.tags); renderChips(document.querySelector('#detailActivity'), data.activity); renderChips(document.querySelector('#detailAccess'), data.access);
    loadDetails(data);
  }

  function createFolderCard(folder) {
    const detail = folderToDetail(folder);
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'dossier-item folder'; card.dataset.id = String(detail.id); card.dataset.kind = 'folder'; card.dataset.search = `${detail.title} ${detail.description} ${detail.tags.join(' ')}`; card.title = 'Double-clique pour ouvrir ce dossier';
    const fav = detail.isFavorite ? ' ★' : '';
    const folders = detail.foldersCount > 0 ? `${detail.foldersCount} dossier${detail.foldersCount > 1 ? 's' : ''}` : '';
    const files = detail.filesCount > 0 ? `${detail.filesCount} fichier${detail.filesCount > 1 ? 's' : ''}` : '';
    const meta = [folders, files].filter(Boolean).join(' · ') || confidentialityLabel(folder.confidentiality_level);
    card.innerHTML = `<span class="item-menu">⋮</span><span class="folder-icon"></span><strong>${escapeHtml(detail.title)}${fav}</strong><small>${escapeHtml(meta)}</small>`;
    card.addEventListener('click', () => selectItem(detail));
    card.addEventListener('dblclick', () => openFolder(detail.id));
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
    card.type = 'button'; card.className = 'dossier-item file'; card.dataset.id = String(detail.id); card.dataset.kind = 'file'; card.dataset.search = `${detail.title} ${detail.description} ${detail.tags.join(' ')}`;
    const preview = previewClass(file.extension);
    const previewInner = preview === 'video-preview' ? '<i>▶</i>' : preview === 'audio-preview' ? '<i></i>' : `<span>${detail.extension}</span>`;
    card.innerHTML = `<span class="item-menu">⋮</span><span class="file-preview ${preview}">${previewInner}</span><strong>${escapeHtml(detail.title)}${detail.isFavorite ? ' ★' : ''}</strong><small>${escapeHtml(detail.size)} · ${escapeHtml(formatDate(file.created_at).split(' à ')[0])}</small><span class="file-badge ${String(file.extension || '').toLowerCase()}">${escapeHtml(detail.extension)}</span>`;
    card.addEventListener('click', () => selectItem(detail));
    card.addEventListener('dblclick', () => downloadSelected(detail));
    return card;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }

  function renderBreadcrumb() {
    if (!breadcrumbEl) return;
    breadcrumbEl.innerHTML = '';
    const root = document.createElement('button');
    root.type = 'button'; root.className = 'dossiers-breadcrumb-button'; root.textContent = state.serviceCode; root.title = 'Retourner à la racine du service'; root.addEventListener('click', () => openFolder(null));
    breadcrumbEl.appendChild(root);
    state.breadcrumb.forEach((item) => {
      const sep = document.createElement('span'); sep.textContent = '›';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'dossiers-breadcrumb-button'; button.textContent = item.name; button.addEventListener('click', () => openFolder(Number(item.id)));
      breadcrumbEl.append(sep, button);
    });
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
    grid.innerHTML = ''; grid.dataset.view = state.view;
    const backCard = renderBackCard(); if (backCard) grid.appendChild(backCard);
    state.folders.forEach((folder) => grid.appendChild(createFolderCard(folder)));
    state.files.forEach((file) => grid.appendChild(createFileCard(file)));
    if (state.folders.length === 0 && state.files.length === 0) {
      const empty = document.createElement('div'); empty.className = 'dossiers-empty-state'; empty.innerHTML = '<strong>Aucun élément ici.</strong><span>Utilise “+ Nouveau” pour créer un dossier ou importer un fichier.</span>'; grid.appendChild(empty); selectItem(null); return;
    }
    if (state.folders.length > 0) selectItem(folderToDetail(state.folders[0]));
    else if (state.files.length > 0) selectItem(fileToDetail(state.files[0]));
    else selectItem(null);
  }

  async function loadFolders() {
    const params = new URLSearchParams(); params.set('action', 'list'); params.set('view', state.quickView);
    if (state.parentId !== null && state.quickView === 'all') params.set('parent_id', String(state.parentId));
    const query = searchInput?.value.trim() || ''; if (query !== '') params.set('q', query);
    grid.innerHTML = '<div class="dossiers-empty-state"><strong>Chargement...</strong><span>Récupération des éléments du service.</span></div>';
    const payload = await requestJson(`/api/dossiers.php?${params.toString()}`);
    state.serviceCode = payload.service_code || state.serviceCode; state.folders = Array.isArray(payload.folders) ? payload.folders : []; state.files = Array.isArray(payload.files) ? payload.files : []; state.breadcrumb = Array.isArray(payload.breadcrumb) ? payload.breadcrumb : [];
    renderBreadcrumb(); renderGrid(); updateUrl(); setFeedback('');
  }

  async function openFolder(id) {
    state.quickView = 'all';
    document.querySelectorAll('.dossiers-quick-card').forEach((card) => card.classList.toggle('is-active', card.dataset.filter === 'all'));
    state.parentId = id === null || id === undefined ? null : Number(id);
    await loadFolders().catch((error) => setFeedback(error.message, 'error'));
  }

  async function createFolder() {
    const name = window.prompt('Nom du dossier à créer :'); if (!name || !name.trim()) return;
    const description = window.prompt('Description optionnelle :') || '';
    const confidentiality = window.prompt('Niveau d’accès : private, service, restricted, confidential', 'service') || 'service';
    try {
      setFeedback('Création du dossier en cours...');
      const payload = await requestJson('/api/dossiers.php?action=create-folder', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim(), confidentiality_level: confidentiality.trim(), parent_id: state.parentId }) });
      await loadFolders(); if (payload.folder) selectItem(folderToDetail(payload.folder)); setFeedback('Dossier créé avec succès.', 'success');
    } catch (error) { setFeedback(error.message, 'error'); }
  }

  function ensureUploadInput() {
    if (uploadInput) return uploadInput;
    uploadInput = document.createElement('input'); uploadInput.type = 'file'; uploadInput.multiple = true; uploadInput.hidden = true;
    uploadInput.accept = '.png,.jpg,.jpeg,.webp,.pdf,.txt,.doc,.docx,.mp4,.webm,.mp3,.wav,.ogg,.zip';
    uploadInput.addEventListener('change', uploadFiles);
    document.body.appendChild(uploadInput);
    return uploadInput;
  }

  async function uploadFiles() {
    const files = Array.from(uploadInput.files || []); if (!files.length) return;
    const formData = new FormData(); files.forEach((file) => formData.append('files[]', file));
    if (state.parentId) formData.append('folder_id', String(state.parentId));
    formData.append('confidentiality_level', window.prompt('Niveau d’accès fichier : private, service, restricted, confidential', 'service') || 'service');
    try { setFeedback('Import en cours...'); await requestJson('/api/dossiers.php?action=upload-file', { method: 'POST', body: formData }); uploadInput.value = ''; await loadFolders(); setFeedback('Fichier importé avec succès.', 'success'); }
    catch (error) { setFeedback(error.message, 'error'); }
  }

  function newMenu() {
    const choice = window.prompt('Action : dossier / fichier', 'dossier');
    if (!choice) return;
    if (choice.trim().toLowerCase().startsWith('f')) ensureUploadInput().click();
    else createFolder();
  }

  async function updateSelected() {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    const name = window.prompt('Nouveau nom :', state.selected.title); if (!name || !name.trim()) return;
    const description = window.prompt('Description :', state.selected.description) || '';
    const confidentiality = window.prompt('Niveau d’accès : private, service, restricted, confidential', state.selected.raw?.confidentiality_level || 'service') || 'service';
    const tags = (window.prompt('Tags séparés par des virgules :', state.selected.tags.join(', ')) || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    try { await requestJson('/api/dossiers.php?action=update', { method: 'POST', body: JSON.stringify({ type: state.selected.type, id: state.selected.id, name, description, confidentiality_level: confidentiality, tags }) }); await loadFolders(); setFeedback('Élément modifié.', 'success'); }
    catch (error) { setFeedback(error.message, 'error'); }
  }

  async function simpleAction(action, successMessage) {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    if (['delete', 'archive'].includes(action) && !window.confirm('Confirmer cette action ?')) return;
    try { await requestJson(`/api/dossiers.php?action=${action}`, { method: 'POST', body: JSON.stringify({ type: state.selected.type, id: state.selected.id }) }); await loadFolders(); setFeedback(successMessage, 'success'); }
    catch (error) { setFeedback(error.message, 'error'); }
  }

  async function toggleFavorite() {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    const enabled = !state.selected.isFavorite;
    try { await requestJson('/api/dossiers.php?action=favorite', { method: 'POST', body: JSON.stringify({ type: state.selected.type, id: state.selected.id, enabled }) }); state.selected.isFavorite = enabled; document.querySelector('#favoriteButton').textContent = enabled ? '★' : '☆'; await loadFolders(); setFeedback(enabled ? 'Ajouté aux favoris.' : 'Retiré des favoris.', 'success'); }
    catch (error) { setFeedback(error.message, 'error'); }
  }

  async function manageAccess() {
    if (!state.selected) return setFeedback('Aucun élément sélectionné.', 'error');
    const subjectType = window.prompt('Type de cible : user / service / rank', 'service') || 'service';
    const subjectValue = window.prompt('Valeur cible : ex FIB, 12, director', state.serviceCode) || state.serviceCode;
    const permission = window.prompt('Permission : view, upload, edit, delete, restore, download, share, manage_access, archive, owner', 'view') || 'view';
    try { const payload = await requestJson('/api/dossiers.php?action=permission', { method: 'POST', body: JSON.stringify({ type: state.selected.type, id: state.selected.id, subject_type: subjectType, subject_value: subjectValue, permission }) }); renderChips(document.querySelector('#detailAccess'), (payload.permissions || []).map((p) => `${p.subject_type}:${p.subject_value} · ${p.permission}`)); setFeedback('Accès ajouté.', 'success'); }
    catch (error) { setFeedback(error.message, 'error'); }
  }

  function downloadSelected(data = state.selected) {
    if (!data || data.type !== 'file') return setFeedback('Sélectionne un fichier à télécharger.', 'error');
    window.open(`/api/dossiers.php?action=download&id=${data.id}`, '_blank');
  }

  document.querySelectorAll('.detail-tabs button').forEach((tab) => tab.addEventListener('click', () => { document.querySelectorAll('.detail-tabs button').forEach((button) => button.classList.toggle('is-active', button === tab)); document.querySelectorAll('.detail-tab-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab)); }));
  document.querySelectorAll('.dossiers-view-toggle button').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.dossiers-view-toggle button').forEach((current) => current.classList.toggle('is-active', current === button)); state.view = button.dataset.view || 'grid'; grid.dataset.view = state.view; }));
  document.querySelectorAll('.dossiers-quick-card').forEach((card) => card.addEventListener('click', () => { document.querySelectorAll('.dossiers-quick-card').forEach((current) => current.classList.toggle('is-active', current === card)); state.quickView = card.dataset.filter || 'all'; if (state.quickView !== 'all') state.parentId = null; loadFolders().catch((error) => setFeedback(error.message, 'error')); }));

  let searchTimeout = null;
  searchInput?.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => loadFolders().catch((error) => setFeedback(error.message, 'error')), 250); });
  document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput?.focus(); } });

  document.querySelector('#newDossierButton')?.addEventListener('click', newMenu);
  document.querySelector('#manageAccessButton')?.addEventListener('click', manageAccess);
  document.querySelector('#favoriteButton')?.addEventListener('click', toggleFavorite);

  const footerButtons = document.querySelectorAll('.detail-footer-actions button');
  footerButtons[0]?.addEventListener('click', manageAccess);
  footerButtons[1]?.addEventListener('click', updateSelected);
  footerButtons[2]?.addEventListener('click', () => downloadSelected());
  footerButtons[3]?.addEventListener('click', () => simpleAction('archive', 'Élément archivé.'));
  footerButtons[4]?.addEventListener('click', () => state.quickView === 'trash' ? simpleAction('restore', 'Élément restauré.') : simpleAction('delete', 'Élément envoyé dans la corbeille.'));

  window.addEventListener('popstate', () => { const folderId = new URLSearchParams(window.location.search).get('folder_id'); state.parentId = folderId && Number(folderId) > 0 ? Number(folderId) : null; loadFolders().catch((error) => setFeedback(error.message, 'error')); });

  loadFolders().catch((error) => { setFeedback(error.message, 'error'); grid.innerHTML = '<div class="dossiers-empty-state"><strong>Module dossiers non initialisé.</strong><span>Vérifie que les migrations SQL 023 et 024 ont bien été exécutées.</span></div>'; selectItem(null); });
})();
