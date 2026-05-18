(() => {
  function loadLinkedReportPreviewFixes() {
    if (document.querySelector('script[data-linked-report-fixes="1"]')) return;
    const script = document.createElement('script');
    script.src = '/search-linked-report-fixes.js?v=1';
    script.async = false;
    script.dataset.linkedReportFixes = '1';
    document.head.appendChild(script);
  }

  loadLinkedReportPreviewFixes();

  function activateReportsNavLink() {
    document.querySelectorAll('.mdt-nav-link').forEach((link) => {
      const label = (link.textContent || '').trim().toLowerCase();
      if (!label.startsWith('rapports')) return;
      link.href = '/reports.php';
      link.classList.remove('disabled');
      link.querySelector('.mdt-placeholder')?.remove();
    });
  }

  activateReportsNavLink();

  async function parseResponse(response) {
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('Réponse serveur invalide pour les notes service.');
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Action refusée.');
    }

    return result;
  }

  async function getServiceNote(citizenId) {
    const response = await fetch(`/api/citizen-service-notes.php?citizen_id=${encodeURIComponent(citizenId)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return parseResponse(response);
  }

  async function saveServiceNote(citizenId, notes) {
    const response = await fetch('/api/citizen-service-notes.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ citizen_id: citizenId, notes }),
    });
    return parseResponse(response);
  }

  function getNotesPanel() {
    return document.querySelector('[data-panel="notes"]');
  }

  function getServiceTextarea() {
    return document.querySelector('#serviceInternalNotes');
  }

  function ensureServiceNotesUi() {
    const formGrid = getNotesPanel()?.querySelector('.form-grid');
    if (!formGrid || getServiceTextarea()) return;

    const sharedLabel = formGrid.querySelector('label');
    if (sharedLabel?.firstChild) {
      sharedLabel.firstChild.textContent = 'Notes interservices';
    }

    const label = document.createElement('label');
    label.innerHTML = 'Notes internes service<textarea id="serviceInternalNotes" rows="9" placeholder="Visible uniquement par le service actif."></textarea>';
    formGrid.appendChild(label);
  }

  function removeOldInternalReadonly() {
    getNotesPanel()?.querySelectorAll('[data-service-note-readonly="1"]').forEach((node) => node.remove());
  }

  function appendInternalReadonly(notes, serviceCode) {
    removeOldInternalReadonly();
    const grid = getNotesPanel()?.querySelector('.readonly-grid');
    if (!grid) return;

    const item = document.createElement('div');
    item.className = 'readonly-item';
    item.dataset.serviceNoteReadonly = '1';
    item.innerHTML = `<span>Notes internes ${escapeHtml(serviceCode || 'service')}</span><strong>${notes ? escapeHtml(notes) : '<span class="empty-value">Non renseigné</span>'}</strong>`;
    grid.appendChild(item);
  }

  async function hydrateServiceNote(citizenId) {
    ensureServiceNotesUi();
    const textarea = getServiceTextarea();
    if (!citizenId) {
      if (textarea) textarea.value = '';
      removeOldInternalReadonly();
      return;
    }

    try {
      const result = await getServiceNote(citizenId);
      ensureServiceNotesUi();
      const refreshedTextarea = getServiceTextarea();
      if (refreshedTextarea) refreshedTextarea.value = result.notes || '';
      appendInternalReadonly(result.notes || '', result.service_code || 'service');
    } catch (error) {
      const textareaNow = getServiceTextarea();
      if (textareaNow) textareaNow.placeholder = error.message;
    }
  }

  const originalLoadCitizen = loadCitizen;
  loadCitizen = async function wrappedLoadCitizen(id) {
    await originalLoadCitizen(id);
    await hydrateServiceNote(id);
  };

  const originalFillCitizen = fillCitizen;
  fillCitizen = function wrappedFillCitizen(citizen) {
    originalFillCitizen(citizen);
    ensureServiceNotesUi();
    if (!citizen?.id) {
      const textarea = getServiceTextarea();
      if (textarea) textarea.value = '';
      removeOldInternalReadonly();
    }
  };

  const originalSaveCitizen = saveCitizen;
  saveCitizen = async function wrappedSaveCitizen() {
    ensureServiceNotesUi();
    const internalNotes = getServiceTextarea()?.value || '';
    await originalSaveCitizen();

    if (selectedCitizenId) {
      try {
        await saveServiceNote(selectedCitizenId, internalNotes);
        await hydrateServiceNote(selectedCitizenId);
      } catch (error) {
        setMessage(error.message);
      }
    }
  };
})();
