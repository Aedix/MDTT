(() => {
  const selected = new Map();
  let activeFilters = { type: 'all', confidentiality: 'all' };
  let activeSort = 'manual';

  const nativeFetch = window.fetch.bind(window);

  function keyOf(type, id) {
    return `${type}:${id}`;
  }

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

  function getCardItem(card) {
    if (!card) return null;
    const type = card.dataset.kind;
    const id = Number(card.dataset.id || 0);
    if (!['folder', 'file'].includes(type) || !id) return null;
    return { type, id, card, key: keyOf(type, id) };
  }

  function syncSelectedStyles() {
    document.querySelectorAll('.dossier-item').forEach((card) => {
      const item = getCardItem(card);
      card.classList.toggle('is-bulk-selected', Boolean(item && selected.has(item.key)));
    });
    renderBulkBar();
  }

  function clearSelection() {
    selected.clear();
    syncSelectedStyles();
  }

  async function loadCounts() {
    try {
      const response = await nativeFetch('/api/dossiers_counts.php', { credentials: 'same-origin' });
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Compteurs indisponibles.');
      Object.entries(payload.counts || {}).forEach(([view, count]) => {
        const card = document.querySelector(`.dossiers-quick-card[data-filter="${view}"] small`);
        if (!card) return;
        const labels = {
          all: 'éléments actifs',
          shared: 'éléments partagés',
          recent: 'éléments récents',
          favorite: 'favoris',
          archive: 'archivés',
          trash: 'en corbeille',
        };
        card.textContent = `${count} ${labels[view] || 'éléments'}`;
      });
    } catch (error) {
      // Non bloquant : les compteurs ne doivent jamais casser la page.
    }
  }

  function ensureBulkBar() {
    if (document.querySelector('#dossiersBulkBar')) return;
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
    const browser = document.querySelector('.dossiers-browser');
    browser?.prepend(bar);

    bar.addEventListener('click', async (event) => {
      const clear = event.target.closest('[data-bulk-clear]');
      if (clear) return clearSelection();
      const actionButton = event.target.closest('[data-bulk-action]');
      if (!actionButton) return;
      await runBulkAction(actionButton.dataset.bulkAction);
    });
  }

  function renderBulkBar() {
    ensureBulkBar();
    const bar = document.querySelector('#dossiersBulkBar');
    if (!bar) return;
    const count = selected.size;
    bar.hidden = count === 0;
    bar.querySelector('[data-bulk-count]').textContent = String(count);
  }

  async function runBulkAction(action) {
    const items = Array.from(selected.values()).map(({ type, id }) => ({ type, id }));
    if (!items.length) return;
    try {
      const response = await nativeFetch('/api/dossiers_bulk.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, items }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) throw new Error(payload.message || 'Action groupée impossible.');
      selected.forEach(({ card }) => card?.remove());
      clearSelection();
      await loadCounts();
      toast(payload.message || 'Action groupée effectuée.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function enhanceBulkSelection() {
    ensureBulkBar();
    document.querySelectorAll('.dossier-item.folder, .dossier-item.file').forEach((card) => {
      if (card.dataset.bulkReady === '1') return;
      card.dataset.bulkReady = '1';
      card.addEventListener('click', (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        const item = getCardItem(card);
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        if (selected.has(item.key)) selected.delete(item.key);
        else selected.set(item.key, item);
        syncSelectedStyles();
      }, true);
    });
    syncSelectedStyles();
  }

  function ensureFilterPanel() {
    if (document.querySelector('#dossiersFilterPanel')) return;
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
      activeFilters.type = panel.querySelector('[data-filter-type]').value;
      activeSort = panel.querySelector('[data-filter-sort]').value;
      applyLocalFilters();
    });
    panel.querySelector('[data-filter-reset]').addEventListener('click', () => {
      activeFilters = { type: 'all', confidentiality: 'all' };
      activeSort = 'manual';
      panel.querySelector('[data-filter-type]').value = 'all';
      panel.querySelector('[data-filter-sort]').value = 'manual';
      applyLocalFilters();
    });
  }

  function wireFilterButton() {
    const button = Array.from(document.querySelectorAll('.dossiers-tool-button')).find((btn) => btn.textContent.includes('Filtres'));
    if (!button || button.dataset.filterReady === '1') return;
    button.dataset.filterReady = '1';
    button.addEventListener('click', () => {
      ensureFilterPanel();
      const panel = document.querySelector('#dossiersFilterPanel');
      const rect = button.getBoundingClientRect();
      panel.style.top = `${rect.bottom + 8}px`;
      panel.style.left = `${Math.max(12, rect.right - 280)}px`;
      panel.hidden = !panel.hidden;
    });
  }

  function cardType(card) {
    if (card.classList.contains('folder')) return 'folder';
    const badge = (card.querySelector('.file-badge')?.textContent || '').trim().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'img'].includes(badge)) return 'image';
    if (badge === 'pdf') return 'pdf';
    if (['mp4', 'webm'].includes(badge)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(badge)) return 'audio';
    if (['html', 'txt'].includes(badge)) return 'note';
    return 'file';
  }

  function applyLocalFilters() {
    const cards = Array.from(document.querySelectorAll('#dossiersGrid .dossier-item')).filter((card) => !card.classList.contains('dossier-back-card'));
    cards.forEach((card) => {
      const type = cardType(card);
      const show = activeFilters.type === 'all' || activeFilters.type === type || (activeFilters.type === 'file' && !card.classList.contains('folder'));
      card.hidden = !show;
    });

    if (activeSort !== 'manual') {
      const grid = document.querySelector('#dossiersGrid');
      const visibleCards = cards.filter((card) => !card.hidden);
      visibleCards.sort((a, b) => {
        const an = a.querySelector('strong')?.textContent?.trim().toLowerCase() || '';
        const bn = b.querySelector('strong')?.textContent?.trim().toLowerCase() || '';
        if (activeSort === 'name_desc') return bn.localeCompare(an);
        if (activeSort === 'type') return cardType(a).localeCompare(cardType(b)) || an.localeCompare(bn);
        return an.localeCompare(bn);
      });
      visibleCards.forEach((card) => grid.appendChild(card));
    }
  }

  function refreshEnhancements() {
    enhanceBulkSelection();
    wireFilterButton();
    applyLocalFilters();
  }

  const observer = new MutationObserver(refreshEnhancements);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', () => {
    loadCounts();
    refreshEnhancements();
  });
  document.addEventListener('click', () => setTimeout(() => { loadCounts(); refreshEnhancements(); }, 160));

  loadCounts();
  refreshEnhancements();
})();
