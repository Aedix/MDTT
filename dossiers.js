(() => {
  const items = {
    'case-root': {
      icon: 'folder', title: 'Dossier #FIB-2026-041', subtype: 'Dossier d’enquête', badge: 'Confidentiel',
      description: 'Dossier relatif à l’enquête sur le trafic d’armes dans le sud de Los Santos.', owner: 'Agent Carter', service: 'FIB',
      created: '17/05/2026 à 14:32', updated: '18/05/2026 à 16:45', tags: ['enquête', 'trafic d’armes', 'sud LS'], linked: 'Enquête #FIB-2026-041',
      activity: ['16:45 · Agent Carter a modifié les accès', '16:20 · Agent Blake a ajouté 3 fichiers', '15:32 · Supervisor Lewis a consulté Camera_24.mp4'],
      access: ['Restreint · Agents assignés', 'Agent Carter · Propriétaire', 'Agent Blake · Lecture / écriture', 'LSPD · Lecture seule']
    },
    proofs: { icon: 'folder', title: 'Preuves', subtype: 'Sous-dossier', badge: 'Restreint', description: 'Regroupe les éléments exploitables en enquête : images, vidéos, audios et documents.', owner: 'Agent Carter', service: 'FIB', created: '17/05/2026 à 15:02', updated: '18/05/2026 à 16:20', tags: ['preuves', 'enquête'], linked: 'Dossier #FIB-2026-041', activity: ['16:20 · 3 fichiers ajoutés', '14:11 · Dossier consulté'], access: ['Restreint · Service FIB', 'Supervision · Lecture / écriture'] },
    reports: { icon: 'folder', title: 'Rapports', subtype: 'Sous-dossier', badge: 'Service', description: 'Rapports d’interrogatoire, constats et documents opérationnels liés au dossier.', owner: 'Agent Blake', service: 'FIB', created: '17/05/2026 à 15:04', updated: '18/05/2026 à 12:10', tags: ['rapports', 'pdf'], linked: 'Dossier #FIB-2026-041', activity: ['12:10 · Rapport interrogatoire importé'], access: ['Service FIB · Lecture', 'Agents assignés · Écriture'] },
    photos: { icon: 'folder', title: 'Photos', subtype: 'Sous-dossier', badge: 'Restreint', description: 'Photos de scène, suspects, véhicules et captures visuelles associées.', owner: 'Agent Carter', service: 'FIB', created: '17/05/2026 à 15:05', updated: '18/05/2026 à 13:44', tags: ['photos', 'img', 'preuves'], linked: 'Dossier #FIB-2026-041', activity: ['13:44 · Photo_scene_01.jpg ajoutée'], access: ['Restreint · Agents assignés'] },
    videos: { icon: 'folder', title: 'Vidéos', subtype: 'Sous-dossier', badge: 'Confidentiel', description: 'Bodycam, dashcam, caméras urbaines et fichiers vidéo volumineux.', owner: 'Supervisor Lewis', service: 'FIB', created: '17/05/2026 à 15:06', updated: '18/05/2026 à 15:32', tags: ['vidéos', 'mp4', 'caméra'], linked: 'Dossier #FIB-2026-041', activity: ['15:32 · Camera_24 consulté'], access: ['Confidentiel · Supervision + assignés'] },
    audios: { icon: 'folder', title: 'Audios', subtype: 'Sous-dossier', badge: 'Restreint', description: 'Appels radio, 911, témoignages vocaux et interceptions validées RP.', owner: 'Agent Blake', service: 'FIB', created: '17/05/2026 à 15:07', updated: '17/05/2026 à 22:14', tags: ['audio', 'mp3'], linked: 'Dossier #FIB-2026-041', activity: ['22:14 · Enregistrement_911_01.mp3 ajouté'], access: ['Restreint · Service FIB'] },
    'photo-scene': { icon: 'file', title: 'Photo_scene_01.jpg', subtype: 'Image', badge: 'IMG', description: 'Photo de scène importée comme élément visuel de preuve.', owner: 'Agent Blake', service: 'FIB', created: '18/05/2026 à 13:44', updated: '18/05/2026 à 13:44', tags: ['image', 'preuve'], linked: 'Photos', activity: ['13:44 · Fichier importé'], access: ['Restreint · Agents assignés'] },
    'rapport-interrogatoire': { icon: 'file', title: 'Rapport_interrogatoire.pdf', subtype: 'Document PDF', badge: 'PDF', description: 'Rapport formalisé lié à un interrogatoire dans le cadre du dossier.', owner: 'Agent Carter', service: 'FIB', created: '18/05/2026 à 12:10', updated: '18/05/2026 à 12:10', tags: ['rapport', 'interrogatoire'], linked: 'Rapports', activity: ['12:10 · PDF importé'], access: ['Service FIB · Lecture', 'Propriétaire · Écriture'] },
    'camera-video': { icon: 'file', title: 'Camera_24_18-05-2026.mp4', subtype: 'Vidéo', badge: 'MP4', description: 'Extrait vidéo provenant d’une caméra, durée 02:45.', owner: 'Supervisor Lewis', service: 'FIB', created: '18/05/2026 à 15:20', updated: '18/05/2026 à 15:32', tags: ['vidéo', 'caméra'], linked: 'Vidéos', activity: ['15:32 · Fichier consulté', '15:20 · Fichier importé'], access: ['Confidentiel · Supervision'] },
    'audio-911': { icon: 'file', title: 'Enregistrement_911_01.mp3', subtype: 'Audio', badge: 'MP3', description: 'Enregistrement audio associé à un appel d’urgence.', owner: 'Agent Blake', service: 'FIB', created: '17/05/2026 à 22:14', updated: '17/05/2026 à 22:14', tags: ['audio', '911'], linked: 'Audios', activity: ['22:14 · Audio importé'], access: ['Restreint · Service FIB'] },
    notes: { icon: 'file', title: 'Notes_rapides.txt', subtype: 'Texte', badge: 'TXT', description: 'Notes de travail rapides non validées comme rapport officiel.', owner: 'Agent Carter', service: 'FIB', created: '17/05/2026 à 21:03', updated: '17/05/2026 à 21:03', tags: ['notes', 'txt'], linked: 'Dossier #FIB-2026-041', activity: ['21:03 · Note créée'], access: ['Agents assignés · Lecture / écriture'] }
  };

  const grid = document.querySelector('#dossiersGrid');
  const searchInput = document.querySelector('#dossiersSearchInput');
  const feedback = document.querySelector('#dossierFeedback');

  function renderChips(container, values) {
    container.innerHTML = '';
    values.forEach((value) => {
      const chip = document.createElement('span');
      chip.textContent = value;
      container.appendChild(chip);
    });
  }

  function selectItem(id) {
    const data = items[id] || items['case-root'];
    document.querySelectorAll('.dossier-item').forEach((item) => item.classList.toggle('is-selected', item.dataset.id === id));
    document.querySelector('#detailTitle').textContent = data.title;
    document.querySelector('#detailSubtype').textContent = data.subtype;
    document.querySelector('#detailBadge').textContent = data.badge;
    document.querySelector('#detailDescription').textContent = data.description;
    document.querySelector('#detailOwner').textContent = data.owner;
    document.querySelector('#detailService').textContent = data.service;
    document.querySelector('#detailCreated').textContent = data.created;
    document.querySelector('#detailUpdated').textContent = data.updated;
    document.querySelector('#detailLinked').textContent = data.linked;
    document.querySelector('#detailIcon').className = data.icon === 'folder' ? 'folder-icon' : 'file-detail-icon';
    renderChips(document.querySelector('#detailTags'), data.tags);
    renderChips(document.querySelector('#detailActivity'), data.activity);
    renderChips(document.querySelector('#detailAccess'), data.access);
  }

  document.querySelectorAll('.dossier-item').forEach((item) => {
    item.addEventListener('click', () => selectItem(item.dataset.id));
  });

  document.querySelectorAll('.detail-tabs button').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.detail-tabs button').forEach((button) => button.classList.toggle('is-active', button === tab));
      document.querySelectorAll('.detail-tab-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab));
    });
  });

  document.querySelectorAll('.dossiers-view-toggle button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.dossiers-view-toggle button').forEach((current) => current.classList.toggle('is-active', current === button));
      grid.dataset.view = button.dataset.view;
    });
  });

  document.querySelectorAll('.dossiers-quick-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.dossiers-quick-card').forEach((current) => current.classList.toggle('is-active', current === card));
      feedback.textContent = `Vue préparée : ${card.querySelector('strong')?.textContent || 'raccourci'}.`;
    });
  });

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('.dossier-item').forEach((item) => {
      const haystack = `${item.textContent} ${item.dataset.search || ''}`.toLowerCase();
      item.hidden = query !== '' && !haystack.includes(query);
    });
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput?.focus();
    }
  });

  document.querySelector('#newDossierButton')?.addEventListener('click', () => {
    feedback.textContent = 'Action préparée : futur menu de création dossier / import fichier.';
  });

  document.querySelector('#manageAccessButton')?.addEventListener('click', () => {
    feedback.textContent = 'Action préparée : future gestion des permissions et accès.';
  });

  selectItem('case-root');
})();
