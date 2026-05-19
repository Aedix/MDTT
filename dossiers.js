(() => {
  const state = {
    parentId: null,
    selected: null,
    folders: [],
    files: [],
    breadcrumb: [],
    serviceCode: 'MDT',
    view: 'grid',
  };

  const grid = document.querySelector('#dossiersGrid');
  const searchInput = document.querySelector('#dossiersSearchInput');
  const feedback = document.querySelector('#dossierFeedback');
  const breadcrumbEl = document.querySelector('.dossiers-breadcrumb');

  function setFeedback(message, type = 'info') {
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.dataset.type = type;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' à ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function confidentialityLabel(value) {
    return {
      private: 'Privé',
      service: 'Service',
      restricted: 'Restreint',
      confidential: 'Confidentiel',
    }[value] || 'Service';
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
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message || 'Erreur de communication avec le serveur.');
    }
    return payload;
  }

  function folderToDetail(folder) {
    return {
      type: 'folder',
      id: Number(folder.id),
      title: folder.name || 'Dossier sans nom',
      subtype: folder.category && folder.category !== 'general' ? folder.category : 'Dossier',
      badge: confidentialityLabel(folder.confidentiality_level),
      description: folder.description || 'Aucune description renseignée pour ce dossier.',
      owner: folder.owner_username || 'Non défini',
      service: folder.service_code || state.serviceCode,
      created: formatDate(folder.created_at),
      updated: formatDate(folder.updated_at),
      tags: [folder.category || 'general', folder.status || 'active', confidentialityLabel(folder.confidentiality_level)],
      linked: folder.parent_id ? `Dossier parent #${folder.parent_id}` : 'Racine du service',
      activity: ['Activité détaillée prévue à l’étape logs.'],
      access: [`Niveau : ${confidentialityLabel(folder.confidentiality_level)}`, `Service : ${folder.service_code || state.serviceCode}`, `Propriétaire : ${folder.owner_username || 'Non défini'}`],
      foldersCount: Number(folder.folders_count || 0),
      filesCount: Number(folder.files_count || 0),
    };
  }

  function selectItem(item) {
    const data = item || null;
    state.selected = data;
    document.querySelectorAll('.dossier-item').forEach((card) => {
      card.classList.toggle('is-selected', data && card.dataset.id === String(data.id) && card.dataset.kind === data.type);
    });

    if (!data) {
      document.querySelector('#detailTitle').textContent = 'Aucun élément sélectionné';
      document.querySelector('#detailSubtype').textContent = 'Sélection';
      document.querySelector('#detailBadge').textContent = '—';
      document.querySelector('#detailDescription').textContent = 'Sélectionne un dossier pour afficher ses informations.';
      document.querySelector('#detailOwner').textContent = '—';
      document.querySelector('#detailService').textContent = state.serviceCode;
      document.querySelector('#detailCreated').textContent = '—';
      document.querySelector('#detailUpdated').textContent = '—';
      document.querySelector('#detailLinked').textContent = '—';
      renderChips(document.querySelector('#detailTags'), []);
      renderChips(document.querySelector('#detailActivity'), []);
      renderChips(document.querySelector('#detailAccess'), []);
      return;
    }

    document.querySelector('#detailTitle').textContent = data.title;
    document.querySelector('#detailSubtype').textContent = data.subtype;
    document.querySelector('#detailBadge').textContent = data.badge;
    document.querySelector('#detailDescription').textContent = data.description;
    document.querySelector('#detailOwner').textContent = data.owner;
    document.querySelector('#detailService').textContent = data.service;
    document.querySelector('#detailCreated').textContent = data.created;
    document.querySelector('#detailUpdated').textContent = data.updated;
    document.querySelector('#detailLinked').textContent = data.linked;
    document.querySelector('#detailIcon').className = 'folder-icon';
    renderChips(document.querySelector('#detailTags'), data.tags);
    renderChips(document.querySelector('#detailActivity'), data.activity);
    renderChips(document.querySelector('#detailAccess'), data.access);
  }

  function createFolderCard(folder) {
    const detail = folderToDetail(folder);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'dossier-item folder';
    card.dataset.id = String(detail.id);
    card.dataset.kind = 'folder';
    card.dataset.search = `${detail.title} ${detail.description} ${detail.tags.join(' ')}`;

    const menu = document.createElement('span');
    menu.className = 'item-menu';
    menu.textContent = '⋮';

    const icon = document.createElement('span');
    icon.className = 'folder-icon';

    const title = document.createElement('strong');
    title.textContent = detail.title;

    const meta = document.createElement('small');
    const folders = detail.foldersCount > 0 ? `${detail.foldersCount} dossier${detail.foldersCount > 1 ? 's' : ''}` : '';
    const files = detail.filesCount > 0 ? `${detail.filesCount} fichier${detail.filesCount > 1 ? 's' : ''}` : '';
    meta.textContent = [folders, files].filter(Boolean).join(' · ') || confidentialityLabel(folder.confidentiality_level);

    card.append(menu, icon, title, meta);
    card.addEventListener('click', () => selectItem(detail));
    card.addEventListener('dblclick', () => openFolder(detail.id));
    return card;
  }

  function renderBreadcrumb() {
    if (!breadcrumbEl) return;
    breadcrumbEl.innerHTML = '';

    const root = document.createElement('button');
    root.type = 'button';
    root.className = 'dossiers-breadcrumb-button';
    root.textContent = state.serviceCode;
    root.addEventListener('click', () => openFolder(null));
    breadcrumbEl.appendChild(root);

    state.breadcrumb.forEach((item) => {
      const sep = document.createElement('span');
      sep.textContent = '›';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dossiers-breadcrumb-button';
      button.textContent = item.name;
      button.addEventListener('click', () => openFolder(Number(item.id)));
      breadcrumbEl.append(sep, button);
    });
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = '';
    grid.dataset.view = state.view;

    if (state.parentId !== null) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'dossier-item folder dossier-back-card';
      back.dataset.kind = 'back';
      back.innerHTML = '<span class="folder-icon"></span><strong>Retour</strong><small>Dossier parent</small>';
      const parent = state.breadcrumb.length >= 2 ? Number(state.breadcrumb[state.breadcrumb.length - 2].id) : null;
      back.addEventListener('click', () => openFolder(parent));
      grid.appendChild(back);
    }

    state.folders.forEach((folder) => grid.appendChild(createFolderCard(folder)));

    if (state.folders.length === 0 && state.files.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dossiers-empty-state';
      empty.innerHTML = '<strong>Aucun dossier ici.</strong><span>Crée un premier dossier avec “+ Nouveau”.</span>';
      grid.appendChild(empty);
      selectItem(null);
      return;
    }

    if (state.folders.length > 0) {
      selectItem(folderToDetail(state.folders[0]));
    } else {
      selectItem(null);
    }
  }

  async function loadFolders() {
    const params = new URLSearchParams();
    params.set('action', 'list');
    if (state.parentId !== null) params.set('parent_id', String(state.parentId));
    const query = searchInput?.value.trim() || '';
    if (query !== '') params.set('q', query);

    grid.innerHTML = '<div class="dossiers-empty-state"><strong>Chargement...</strong><span>Récupération des dossiers du service.</span></div>';

    const payload = await requestJson(`/api/dossiers.php?${params.toString()}`);
    state.serviceCode = payload.service_code || state.serviceCode;
    state.folders = Array.isArray(payload.folders) ? payload.folders : [];
    state.files = Array.isArray(payload.files) ? payload.files : [];
    state.breadcrumb = Array.isArray(payload.breadcrumb) ? payload.breadcrumb : [];
    renderBreadcrumb();
    renderGrid();
    setFeedback('');
  }

  async function openFolder(id) {
    state.parentId = id === null || id === undefined ? null : Number(id);
    await loadFolders().catch((error) => setFeedback(error.message, 'error'));
  }

  async function createFolder() {
    const name = window.prompt('Nom du dossier à créer :');
    if (!name || !name.trim()) return;

    const description = window.prompt('Description optionnelle :') || '';
    const confidentiality = window.prompt('Niveau d’accès : private, service, restricted, confidential', 'service') || 'service';

    try {
      setFeedback('Création du dossier en cours...');
      await requestJson('/api/dossiers.php?action=create-folder', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          confidentiality_level: confidentiality.trim(),
          parent_id: state.parentId,
        }),
      });
      setFeedback('Dossier créé avec succès.', 'success');
      await loadFolders();
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  }

  document.querySelectorAll('.detail-tabs button').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tabs button').forEach((button) => button.classList.toggle('is-active', button === tab));
      document.querySelectorAll('.detail-tab-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab));
    });
  });

  document.querySelectorAll('.dossiers-view-toggle button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.dossiers-view-toggle button').forEach((current) => current.classList.toggle('is-active', current === button));
      state.view = button.dataset.view || 'grid';
      grid.dataset.view = state.view;
    });
  });

  document.querySelectorAll('.dossiers-quick-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.dossiers-quick-card').forEach((current) => current.classList.toggle('is-active', current === card));
      setFeedback(`Vue préparée : ${card.querySelector('strong')?.textContent || 'raccourci'}.`);
    });
  });

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
  });

  document.querySelector('#newDossierButton')?.addEventListener('click', createFolder);
  document.querySelector('#manageAccessButton')?.addEventListener('click', () => {
    setFeedback('Gestion des accès prévue dans une prochaine étape.');
  });

  loadFolders().catch((error) => {
    setFeedback(error.message, 'error');
    grid.innerHTML = '<div class="dossiers-empty-state"><strong>Module dossiers non initialisé.</strong><span>Vérifie que la migration SQL 023_dossiers_module.sql a bien été exécutée.</span></div>';
    selectItem(null);
  });
})();
