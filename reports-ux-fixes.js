(() => {
  const CLASSIFICATION_LABELS = {
    unclassified: 'Non classifié',
    internal: 'Interne service',
    confidential: 'Confidentiel',
    restricted_cs: 'Restreint Command Staff',
    declassified: 'Déclassifié',
  };

  const LOG_LABELS = {
    create: 'Rapport créé',
    update: 'Rapport modifié',
    status_change: 'Statut modifié',
    classification_change: 'Classification modifiée',
    seed_confidential_demo: 'Dossier de démonstration créé',
  };

  let currentClassification = 'internal';

  function safe(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function labelClassification(value) {
    return CLASSIFICATION_LABELS[String(value || 'internal')] || value || 'Interne service';
  }

  function parseDetails(text) {
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  function translateLogAction(action, details = {}) {
    if (action === 'status_change') {
      const from = details.from ? statusLabel(details.from) : 'ancien statut';
      const to = details.to ? statusLabel(details.to) : 'nouveau statut';
      return `Statut modifié : ${from} → ${to}`;
    }
    if (action === 'classification_change') {
      const from = details.from ? labelClassification(details.from) : 'ancienne classification';
      const to = details.to ? labelClassification(details.to) : 'nouvelle classification';
      return `Classification modifiée : ${from} → ${to}`;
    }
    return LOG_LABELS[action] || String(action || 'Action MDT');
  }

  function statusLabel(value) {
    const labels = {
      draft: 'Brouillon',
      submitted: 'Soumis',
      review: 'En révision CS',
      validated: 'Validé',
      rejected: 'Rejeté',
      archived: 'Archivé',
    };
    return labels[String(value || '')] || value || 'Non renseigné';
  }

  function patchLogs(rawLogs = []) {
    const logsView = document.querySelector('#reportLogsView');
    if (!logsView) return;
    if (!rawLogs.length) {
      logsView.innerHTML = '<p class="reports-empty">Aucun historique.</p>';
      return;
    }
    logsView.innerHTML = rawLogs.map((log) => {
      const details = parseDetails(log.details);
      return `<div class="report-log readable-log">
        <strong>${safe(translateLogAction(log.action, details))}</strong>
        <span>${safe(log.created_at || '')} · ${safe(log.username || 'Système')}</span>
      </div>`;
    }).join('');
  }

  function refreshConsultationCards() {
    document.querySelectorAll('.report-mini-card').forEach((card) => {
      const title = card.querySelector('h4')?.textContent?.trim().toLowerCase() || '';
      if (title === 'classification') {
        card.innerHTML = `<h4>Classification</h4><p><span class="report-badge classification">${safe(labelClassification(currentClassification))}</span></p>`;
      }
    });

    document.querySelectorAll('.workflow-step').forEach((step) => {
      const text = step.textContent.trim().toLowerCase();
      step.classList.toggle('workflow-draft', text.includes('brouillon'));
      step.classList.toggle('workflow-submitted', text === 'soumis');
      step.classList.toggle('workflow-review', text.includes('révision'));
      step.classList.toggle('workflow-validated', text.includes('validé'));
      step.classList.toggle('workflow-rejected', text.includes('rejeté'));
      step.classList.toggle('workflow-archived', text.includes('archivé'));
    });

    document.querySelectorAll('.report-timeline-item strong').forEach((strong) => {
      const action = strong.textContent.trim();
      strong.textContent = LOG_LABELS[action] || action;
    });
  }

  function jumpToLinkedCitizen(id, vehicleId = '') {
    const params = new URLSearchParams();
    params.set('citizen_id', String(id));
    if (vehicleId) params.set('vehicle_id', String(vehicleId));
    window.location.href = `/search.php?${params.toString()}`;
  }

  const baseFillReport = window.fillReport;
  if (typeof baseFillReport === 'function') {
    window.fillReport = function fillReportUxFixed(report = null, extra = {}) {
      currentClassification = report?.classification_level || 'internal';
      baseFillReport(report, extra);
      setTimeout(() => {
        patchLogs(extra.logs || []);
        refreshConsultationCards();
      }, 60);
    };
  }

  const baseRenderLinks = window.renderLinks;
  if (typeof baseRenderLinks === 'function') {
    window.renderLinks = function renderLinksUxFixed(data = {}) {
      baseRenderLinks(data);
      if (Array.isArray(data.vehicles) && typeof linkedVehicles !== 'undefined') {
        linkedVehicles = data.vehicles.map((v) => ({
          id: Number(v.id),
          citizen_id: Number(v.citizen_id || 0),
          label: `${v.model || 'Véhicule'} · ${v.plate || ''}`,
          meta: v.relation_type,
        }));
      }
    };
  }

  document.addEventListener('click', (event) => {
    const citizen = event.target.closest('[data-open-citizen]');
    if (citizen) {
      event.preventDefault();
      event.stopPropagation();
      jumpToLinkedCitizen(citizen.dataset.openCitizen);
      return;
    }

    const vehicle = event.target.closest('[data-open-vehicle]');
    if (vehicle) {
      event.preventDefault();
      event.stopPropagation();
      const vehicleId = Number(vehicle.dataset.openVehicle || 0);
      const linked = typeof linkedVehicles !== 'undefined' ? linkedVehicles.find((item) => Number(item.id) === vehicleId) : null;
      if (linked?.citizen_id) jumpToLinkedCitizen(linked.citizen_id, vehicleId);
    }
  }, true);

  new MutationObserver(() => refreshConsultationCards()).observe(document.body, { childList: true, subtree: true });
  setInterval(refreshConsultationCards, 1000);
})();
