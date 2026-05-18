(() => {
  const CLASSIFICATION_LABELS = {
    unclassified: 'Non classifié',
    internal: 'Interne service',
    confidential: 'Confidentiel',
    restricted_cs: 'Restreint Command Staff',
    declassified: 'Déclassifié',
  };

  const CLASSIFICATION_COPY = {
    unclassified: {
      icon: '◇',
      title: 'Document non classifié — consultation standard',
      description: 'Ce rapport suit les règles de visibilité définies pour le document.',
    },
    internal: {
      icon: '◈',
      title: 'Document interne service — consultation encadrée',
      description: 'Visible par le service propriétaire selon les accès du MDT.',
    },
    confidential: {
      icon: '◆',
      title: 'Document confidentiel — diffusion limitée',
      description: 'Consultation réservée aux profils autorisés et au service propriétaire.',
    },
    restricted_cs: {
      icon: 'CS',
      title: 'Document restreint Command Staff — accès sensible',
      description: 'Consultation réservée au Command Staff / Director autorisé.',
    },
    declassified: {
      icon: '◇',
      title: 'Document déclassifié — version consultable',
      description: 'Le document est consultable selon la visibilité définie, avec caviardage si nécessaire.',
    },
  };

  const LOG_LABELS = {
    create: 'Rapport créé',
    update: 'Rapport modifié',
    status_change: 'Statut modifié',
    classification_change: 'Classification modifiée',
    seed_confidential_demo: 'Dossier de démonstration créé',
  };

  let currentClassification = 'internal';
  let currentStatus = 'submitted';
  let lastLogs = [];

  function safe(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function reportsPage() {
    return document.querySelector('.reports-page');
  }

  function closeBlankFocusMode() {
    if (!document.querySelector('.report-panel-inner')) {
      reportsPage()?.classList.remove('report-focus-mode');
    }
  }

  function labelClassification(value) {
    return CLASSIFICATION_LABELS[String(value || 'internal')] || value || 'Interne service';
  }

  function parseDetails(text) {
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  function statusLabel(value) {
    const labels = {
      draft: 'Brouillon',
      submitted: 'En attente CS',
      review: 'En attente CS',
      validated: 'Validé',
      rejected: 'Rejeté',
      archived: 'Archivé',
    };
    return labels[String(value || '')] || value || 'Non renseigné';
  }

  function workflowKey(value) {
    const raw = String(value || 'submitted');
    if (raw === 'review') return 'submitted';
    return raw;
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

  function patchLogs(rawLogs = lastLogs) {
    const logsView = document.querySelector('#reportLogsView');
    if (!logsView) return;
    lastLogs = Array.isArray(rawLogs) ? rawLogs : [];
    if (!lastLogs.length) {
      logsView.innerHTML = '<p class="reports-empty">Aucun historique.</p>';
      return;
    }
    logsView.innerHTML = lastLogs.map((log) => {
      const details = parseDetails(log.details);
      return `<div class="report-log readable-log">
        <strong>${safe(translateLogAction(log.action, details))}</strong>
        <span>${safe(log.created_at || '')} · ${safe(log.username || 'Système')}</span>
      </div>`;
    }).join('');
  }

  function ensureClassificationBanner() {
    const panel = document.querySelector('.report-panel-inner');
    if (!panel) return;

    document.querySelectorAll('.report-mini-card').forEach((card) => {
      const title = card.querySelector('h4')?.textContent?.trim().toLowerCase() || '';
      if (title === 'classification') card.remove();
    });

    let banner = document.querySelector('#reportClassificationBanner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'reportClassificationBanner';
      const after = document.querySelector('#reportLockNotice') || document.querySelector('#reportExperienceLockBanner') || document.querySelector('.report-document-header');
      after?.insertAdjacentElement('afterend', banner);
    }

    const code = String(currentClassification || 'internal');
    const copy = CLASSIFICATION_COPY[code] || CLASSIFICATION_COPY.internal;
    banner.className = `report-classification-banner classification-${code}`;
    banner.innerHTML = `
      <div class="classification-banner-icon">${safe(copy.icon)}</div>
      <div class="classification-banner-copy">
        <strong>${safe(copy.title)}</strong>
        <span>${safe(copy.description)}</span>
        <em>${safe(labelClassification(code))}</em>
      </div>
    `;
  }

  function refreshWorkflowState() {
    const active = workflowKey(currentStatus || document.querySelector('#reportStatus')?.value || 'submitted');
    document.querySelectorAll('.workflow-step').forEach((step) => {
      const text = step.textContent.trim().toLowerCase();
      const isSubmitted = text.includes('attente') || text === 'soumis' || text.includes('révision');
      const key = text.includes('brouillon') ? 'draft'
        : isSubmitted ? 'submitted'
        : text.includes('validé') ? 'validated'
        : text.includes('rejeté') ? 'rejected'
        : text.includes('archivé') ? 'archived'
        : '';

      if (text === 'soumis' || text.includes('révision')) {
        if (step.dataset.normalized !== '1') step.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) node.textContent = ' En attente CS';
        });
        step.dataset.normalized = '1';
      }

      step.classList.toggle('active', key === active);
      step.classList.toggle('workflow-draft', key === 'draft');
      step.classList.toggle('workflow-submitted', key === 'submitted');
      step.classList.toggle('workflow-validated', key === 'validated');
      step.classList.toggle('workflow-rejected', key === 'rejected');
      step.classList.toggle('workflow-archived', key === 'archived');
    });
  }

  function refreshConsultationCards() {
    ensureClassificationBanner();
    refreshWorkflowState();
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
      currentStatus = workflowKey(report?.status || 'submitted');
      baseFillReport(report, extra);
      setTimeout(() => {
        patchLogs(extra.logs || []);
        refreshConsultationCards();
      }, 60);
    };
  }

  const baseRenderDocument = window.renderDocument;
  if (typeof baseRenderDocument === 'function') {
    window.renderDocument = function renderDocumentUxFixed(report = {}) {
      currentClassification = report?.classification_level || currentClassification || 'internal';
      currentStatus = workflowKey(report?.status || document.querySelector('#reportStatus')?.value || currentStatus || 'submitted');
      baseRenderDocument(report);
      setTimeout(refreshConsultationCards, 30);
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
    if (event.target.closest('.report-row') || event.target.closest('#newReportButton')) {
      reportsPage()?.classList.remove('report-focus-mode');
      return;
    }

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

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'reportStatus' || event.target?.id === 'reportStatusSelector') {
      currentStatus = workflowKey(event.target.value || 'submitted');
      setTimeout(refreshWorkflowState, 30);
    }
    if (event.target?.id === 'reportClassification') {
      currentClassification = event.target.value || 'internal';
      setTimeout(ensureClassificationBanner, 30);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    closeBlankFocusMode();
    setTimeout(closeBlankFocusMode, 300);
  });
})();
