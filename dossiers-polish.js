(() => {
  const selected = new Map();
  const labels = {
    all: 'éléments actifs',
    shared: 'éléments partagés',
    recent: 'éléments récents',
    favorite: 'favoris',
    archive: 'archivés',
    trash: 'en corbeille',
  };

  const state = {
    filterType: 'all',
    sort: 'manual',
    initialized: false,
    lastGridSignature: '',
    countsTimer: null,
  };

  const baseFetch = window.fetch.bind(window);

  function byId(id) {
    return document.getElementById(id);
  }

  function cardKey(type, id) {
    return `${type}:${id}`;
  }

  function getCardData(card) {
    if (!card) return null;
    const type = card.dataset.kind;
    const id = Number(card.dataset.id || 0);
    if (!['folder', 'file'].includes(type) || !Number.isFinite(id) || id <= 0) return null;
    return { type, id, key: cardKey(type, id), card };
  }

  function toast(message, type = 'info') {
    const existing = byId('dossiersToast');
    if (existing) {
      existing.textContent = message;
      existing.dataset.type = type;
      existing.hidden = false;
      clearTimeout(existing.__polishTimer);
      existing.__polishTimer = setTimeout(() => { existing.hidden = true; }, type === 'error' ? 4200 : 2600);
      return;
    }

    const feedback = byId('dossierFeedback');
    if (feedback) {
      feedback.textContent = message;
      feedback.dataset.type = type;
    }
  }

  function debounceCounts() {
    clearTimeout(state.countsTimer);
    state.countsTimer = setTimeout(loadCounts, 250);
  }

  async function loadCounts() {
    try {
      const response = await baseFetch('/api/dossiers_counts.php', { credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) return;

      Object.entries(payload.counts || {}).forEach(([view, count]) => {
        const small = document.querySelector(`.dossiers-quick-card[data-filter="${view}"] small`);
        if (!small) return;
        small.textContent = `${Number(count || 0)} ${labels[view] || 'éléments'}`;
      });
    } catch (error) {
      // Non bloquant : un compteur ne doit jamais empêcher le module de fonctionner.
    }
  }

  function ensureBulkBar() {
    if (byId('dossiersBulkBar')) return;
    const browser = document.querySelector('.dossiers-browser');
    if (!browser) return;

    const bar = document.createElement('div');
    bar.id = 'dossiersBulkBar';
    bar.className = 'dossiers-bulk-bar';
    bar.hidden = true;
    bar.innerHTML = `
      <strong><span data-bulk-count>0</span> sélectionné(s)</strong>
      <button type="button" data-bulk-action="archive">Archiver</button>
      <button type="button" data-bulk-action="delete" class="danger">Corbeille</button>
      <button type="button" data-bulk-clear>Annuler</button>
    `;
    browser.insertBefore(bar, browser.firstElementChild);

    bar.addEventListener('click', async (event) => {
      const clear = event.target.closest('[data-bulk-clear]');
      if (clear) {
        clearBulkSelection();
        return;
      }

      const actionButton = event.target.closest('[data-bulk-action]');
      if (!actionButton) return;
      await runBulkAction(actionButton.dataset.bulkAction);
    });
  }

  function clearBulkSelection() {
    selected.clear();
    syncBulkUi();
  }

  function syncBulkUi() {
    document.querySelectorAll('#dossiersGrid .dossier-item').forEach((card) => {
      const data = getCardData(card);
      card.classList.toggle('is-bulk-selected', Boolean(data && selected.has(data.key)));
    });

    const bar = byId('dossiersBulkBar');
    if (!bar) return;
    bar.hidden = selected.size === 0;
    const count = bar.querySelector('[data-bulk-count]');
    if (count) count.textContent = String(selected.size);
  }

  async function runBulkAction(action) {
    const items = Array.from(selected.values()).map(({ type, id }) => ({ type, id }));
    if (!items.length) return;

    try {
      const response = await baseFetch('/api/dossiers_bulk.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, items }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Action groupée impossible.');

      selected.forEach(({ card }) => card?.remove());
      clearBulkSelection();
      debounceCounts();
      toast(payload.message || 'Action groupée effectuée.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function handleGridClick(event) {
    if (!event.ctrlKey && !event.metaKey) return;
    const card = event.target.closest('#dossiersGrid .dossier-item');
    const data = getCardData(card);
    if (!data) return;

    event.preventDefault();
    event.stopPropagation();

    if (selected.has(data.key)) selected.delete(data.key);
    else selected.set(data.key, data);

    syncBulkUi();
  }

  function ensureFilterPanel() {
    if (byId('dossiersFilterPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'dossiersFilterPanel';
    panel.className = 'dossiers-filter-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <label>Type
        <select data-filter-type>
          <option value="all">Tous</option>
          <option value="folder">Dossiers</option>
          <option value="file">Fichiers</option>
          <option value="image">Images</option>
          <option value="pdf">PDF</option>
          <option value="video">Vidéos</option>
          <option value="audio">Audios</option>
          <option value="note">Notes</option>
        </select>
      </label>
      <label>Tri local
        <select data-filter-sort>
          <option value="manual">Ordre actuel</option>
          <option value="name_asc">Nom A-Z</option>
          <option value="name_desc">Nom Z-A</option>
          <option value="type">Type</option>
        </select>
      </label>
      <button type="button" data-filter-reset>Réinitialiser</button>
    `;
    document.body.appendChild(panel);

    panel.addEventListener('change', () => {
      state.filterType = panel.querySelector('[data-filter-type]')?.value || 'all';
      state.sort = panel.querySelector('[data-filter-sort]')?.value || 'manual';
      applyLocalFilters();
    });

    panel.querySelector('[data-filter-reset]')?.addEventListener('click', () => {
      state.filterType = 'all';
      state.sort = 'manual';
      const typeSelect = panel.querySelector('[data-filter-type]');
      const sortSelect = panel.querySelector('[data-filter-sort]');
      if (typeSelect) typeSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'manual';
      applyLocalFilters();
    });
  }

  function openFilterPanel(button) {
    ensureFilterPanel();
    const panel = byId('dossiersFilterPanel');
    if (!panel) return;

    const rect = button.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.left = `${Math.max(12, rect.right - 280)}px`;
    panel.hidden = !panel.hidden;
  }

  function cardTitle(card) {
    return card.querySelector('strong')?.textContent?.replace('★', '').trim().toLowerCase() || '';
  }

  function cardType(card) {
    if (card.classList.contains('folder')) return 'folder';
    const badge = (card.querySelector('.file-badge')?.textContent || '').trim().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'img'].includes(badge)) return 'image';
    if (badge === 'pdf') return 'pdf';
    if (['mp4', 'webm'].includes(badge)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(badge)) return 'audio';
    if (['html', 'htm', 'txt'].includes(badge)) return 'note';
    return 'file';
  }

  function acceptFilter(card) {
    if (state.filterType === 'all') return true;
    const type = cardType(card);
    if (state.filterType === 'file') return !card.classList.contains('folder');
    return type === state.filterType;
  }

  function snapshotGridOrder() {
    const cards = Array.from(document.querySelectorAll('#dossiersGrid .dossier-item'));
    const signature = cards.map((card) => `${card.dataset.kind || ''}:${card.dataset.id || ''}`).join('|');
    if (signature === state.lastGridSignature) return;

    state.lastGridSignature = signature;
    cards.forEach((card, index) => {
      card.dataset.polishOrder = String(index);
    });
    selected.clear();
  }

  function applyLocalFilters() {
    const grid = byId('dossiersGrid');
    if (!grid) return;

    snapshotGridOrder();
    const cards = Array.from(grid.querySelectorAll('.dossier-item')).filter((card) => !card.classList.contains('dossier-back-card'));

    cards.forEach((card) => {
      card.hidden = !acceptFilter(card);
    });

    const sorted = cards.slice().sort((a, b) => {
      if (state.sort === 'manual') return Number(a.dataset.polishOrder || 0) - Number(b.dataset.polishOrder || 0);
      if (state.sort === 'name_desc') return cardTitle(b).localeCompare(cardTitle(a));
      if (state.sort === 'type') return cardType(a).localeCompare(cardType(b)) || cardTitle(a).localeCompare(cardTitle(b));
      return cardTitle(a).localeCompare(cardTitle(b));
    });

    sorted.forEach((card) => grid.appendChild(card));
    syncBulkUi();
  }

  function handleToolbarClick(event) {
    const filterButton = event.target.closest('.dossiers-tool-button');
    if (filterButton && filterButton.textContent.includes('Filtres')) {
      event.preventDefault();
      openFilterPanel(filterButton);
    }
  }

  function scheduleAfterRender() {
    window.setTimeout(() => {
      snapshotGridOrder();
      applyLocalFilters();
      syncBulkUi();
      debounceCounts();
    }, 120);
  }

  window.fetch = async (...args) => {
    const response = await baseFetch(...args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/api/dossiers.php') || url.includes('/api/dossiers_views.php') || url.includes('/api/dossiers_move.php') || url.includes('/api/dossiers_extra.php')) {
        scheduleAfterRender();
      }
    } catch (error) {}

    return response;
  };

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    ensureBulkBar();
    ensureFilterPanel();

    const grid = byId('dossiersGrid');
    if (grid) grid.addEventListener('click', handleGridClick, true);

    const toolbar = document.querySelector('.dossiers-browser-toolbar');
    if (toolbar) toolbar.addEventListener('click', handleToolbarClick);

    document.addEventListener('click', (event) => {
      const panel = byId('dossiersFilterPanel');
      if (!panel || panel.hidden) return;
      if (panel.contains(event.target) || event.target.closest('.dossiers-tool-button')) return;
      panel.hidden = true;
    });

    loadCounts();
    scheduleAfterRender();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
