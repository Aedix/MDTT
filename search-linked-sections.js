(() => {
  function linkedEscape(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  async function linkedApiGet(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide.'); }
    if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
    return result;
  }

  async function linkedApiPost(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide.'); }
    if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
    return result;
  }

  function ensureLinkedTabs() {
    const tabs = document.querySelector('.citizen-tabs');
    const panels = document.querySelector('.citizen-tab-panels');
    if (!tabs || !panels || tabs.querySelector('[data-tab="linkedReports"]')) return;

    const reportsTab = document.createElement('button');
    reportsTab.type = 'button';
    reportsTab.className = 'citizen-tab';
    reportsTab.dataset.tab = 'linkedReports';
    reportsTab.textContent = 'Rapports';

    const complaintsTab = document.createElement('button');
    complaintsTab.type = 'button';
    complaintsTab.className = 'citizen-tab';
    complaintsTab.dataset.tab = 'complaints';
    complaintsTab.textContent = 'Plaintes';

    tabs.append(reportsTab, complaintsTab);

    const reportsPanel = document.createElement('section');
    reportsPanel.className = 'citizen-tab-panel';
    reportsPanel.dataset.panel = 'linkedReports';
    reportsPanel.innerHTML = `
      <div class="subcard-header clean">
        <div><p class="mdt-kicker">Liaisons</p><h3>Rapports liés</h3></div>
      </div>
      <div id="linkedReportsList" class="record-list compact"><p class="search-empty">Aucun rapport lié.</p></div>
    `;

    const complaintsPanel = document.createElement('section');
    complaintsPanel.className = 'citizen-tab-panel';
    complaintsPanel.dataset.panel = 'complaints';
    complaintsPanel.innerHTML = `
      <div class="subcard-header clean">
        <div><p class="mdt-kicker">Plaintes</p><h3>Plaintes déposées</h3></div>
        <button type="button" id="newComplaintButton" class="mdt-button-secondary">+ Plainte</button>
      </div>
      <div id="complaintsList" class="record-list compact"><p class="search-empty">Aucune plainte enregistrée.</p></div>
      <form id="complaintForm" class="inline-record-form" hidden>
        <input type="hidden" id="complaintId" />
        <div class="form-grid two compact-form">
          <label>Titre<input id="complaintTitle" type="text" /></label>
          <label>Déposant<input id="complainantName" type="text" /></label>
          <label>Date<input id="complaintDate" type="date" /></label>
          <label>Statut<select id="complaintStatus"><option>Ouverte</option><option>En cours</option><option>Classée</option><option>Transmise</option><option>Archivée</option></select></label>
          <label class="wide">Lieu<input id="complaintLocation" type="text" /></label>
          <label class="wide">Description<textarea id="complaintDescription" rows="4"></textarea></label>
          <label class="wide">Notes<textarea id="complaintNotes" rows="3"></textarea></label>
        </div>
        <div class="inline-actions"><button type="submit" class="mdt-button">Valider</button><button type="button" id="cancelComplaintButton" class="mdt-button-secondary">Annuler</button></div>
      </form>
    `;

    panels.append(reportsPanel, complaintsPanel);

    document.querySelectorAll('.citizen-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.citizen-tab').forEach((item) => item.classList.toggle('active', item.dataset.tab === tab.dataset.tab));
        document.querySelectorAll('.citizen-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab.dataset.tab));
      });
    });

    const newComplaintButton = complaintsPanel.querySelector('#newComplaintButton');
    const complaintForm = complaintsPanel.querySelector('#complaintForm');
    const cancelComplaintButton = complaintsPanel.querySelector('#cancelComplaintButton');

    newComplaintButton.addEventListener('click', () => {
      if (!selectedCitizenId) return;
      complaintForm.hidden = false;
      complaintForm.reset();
      complaintForm.querySelector('#complaintId').value = '';
      complaintForm.querySelector('#complaintDate').value = new Date().toISOString().slice(0, 10);
    });

    cancelComplaintButton.addEventListener('click', () => {
      complaintForm.hidden = true;
    });

    complaintForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedCitizenId) return;

      try {
        await linkedApiPost('/api/citizen-links.php?action=save_complaint', {
          id: Number(complaintForm.querySelector('#complaintId').value || 0),
          citizen_id: Number(selectedCitizenId),
          title: complaintForm.querySelector('#complaintTitle').value,
          complainant_name: complaintForm.querySelector('#complainantName').value,
          complaint_date: complaintForm.querySelector('#complaintDate').value,
          location: complaintForm.querySelector('#complaintLocation').value,
          status: complaintForm.querySelector('#complaintStatus').value,
          description: complaintForm.querySelector('#complaintDescription').value,
          notes: complaintForm.querySelector('#complaintNotes').value,
        });
        complaintForm.hidden = true;
        await hydrateCitizenLinks(selectedCitizenId);
      } catch (error) {
        setMessage(error.message);
      }
    });
  }

  function setLinkedBadge(tabName, count) {
    const tab = document.querySelector(`.citizen-tab[data-tab="${tabName}"]`);
    if (!tab) return;
    tab.querySelector('.tab-count')?.remove();
    const badge = document.createElement('span');
    badge.className = 'tab-count';
    badge.textContent = String(count || 0);
    tab.appendChild(badge);
  }

  function renderLinkedReports(reports) {
    const container = document.querySelector('#linkedReportsList');
    if (!container) return;
    setLinkedBadge('linkedReports', reports.length);
    if (!reports.length) {
      container.innerHTML = '<p class="search-empty">Aucun rapport lié.</p>';
      return;
    }

    container.innerHTML = reports.map((report) => `
      <a class="record-item linked-report-item" href="/reports.php?report_id=${Number(report.id)}">
        <div>
          <strong>${linkedEscape(report.report_number)} · ${linkedEscape(report.title)}</strong>
          <p>${linkedEscape([report.service_code, report.type_code, report.status, report.location].filter(Boolean).join(' · '))}</p>
        </div>
      </a>
    `).join('');
  }

  function renderComplaints(complaints) {
    const container = document.querySelector('#complaintsList');
    if (!container) return;
    setLinkedBadge('complaints', complaints.length);
    if (!complaints.length) {
      container.innerHTML = '<p class="search-empty">Aucune plainte enregistrée.</p>';
      return;
    }

    container.innerHTML = complaints.map((complaint) => `
      <div class="record-item complaint-item" data-complaint='${linkedEscape(JSON.stringify(complaint))}'>
        <div>
          <strong>${linkedEscape(complaint.title)}</strong>
          <p>${linkedEscape([complaint.complaint_date, complaint.status, complaint.location].filter(Boolean).join(' · '))}</p>
          ${complaint.complainant_name ? `<p>Déposant : ${linkedEscape(complaint.complainant_name)}</p>` : ''}
          ${complaint.description ? `<p>${linkedEscape(complaint.description)}</p>` : ''}
        </div>
        <div class="record-actions"><button type="button" class="search-icon-button edit-complaint">✎</button></div>
      </div>
    `).join('');
  }

  async function hydrateCitizenLinks(citizenId) {
    ensureLinkedTabs();
    if (!citizenId) {
      renderLinkedReports([]);
      renderComplaints([]);
      return;
    }

    try {
      const result = await linkedApiGet(`/api/citizen-links.php?action=list&citizen_id=${encodeURIComponent(citizenId)}`);
      renderLinkedReports(result.reports || []);
      renderComplaints(result.complaints || []);
    } catch (error) {
      const reports = document.querySelector('#linkedReportsList');
      const complaints = document.querySelector('#complaintsList');
      if (reports) reports.innerHTML = `<p class="search-empty">${linkedEscape(error.message)}</p>`;
      if (complaints) complaints.innerHTML = `<p class="search-empty">${linkedEscape(error.message)}</p>`;
    }
  }

  const originalFillCitizen = fillCitizen;
  fillCitizen = function linkedFillCitizen(citizen) {
    originalFillCitizen(citizen);
    ensureLinkedTabs();
    hydrateCitizenLinks(citizen?.id || null);
  };

  const originalLoadCitizen = loadCitizen;
  loadCitizen = async function linkedLoadCitizen(id) {
    await originalLoadCitizen(id);
    ensureLinkedTabs();
    await hydrateCitizenLinks(id);
  };

  citizenPanel.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-complaint');
    const item = event.target.closest('[data-complaint]');
    if (!editButton || !item) return;

    const complaint = JSON.parse(item.dataset.complaint);
    const form = document.querySelector('#complaintForm');
    if (!form) return;

    form.hidden = false;
    form.querySelector('#complaintId').value = complaint.id || '';
    form.querySelector('#complaintTitle').value = complaint.title || '';
    form.querySelector('#complainantName').value = complaint.complainant_name || '';
    form.querySelector('#complaintDate').value = complaint.complaint_date || '';
    form.querySelector('#complaintLocation').value = complaint.location || '';
    form.querySelector('#complaintStatus').value = complaint.status || 'Ouverte';
    form.querySelector('#complaintDescription').value = complaint.description || '';
    form.querySelector('#complaintNotes').value = complaint.notes || '';
  });
})();
