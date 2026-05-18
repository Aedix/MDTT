(() => {
  if (typeof window.MDT_CAN_REDACT_REPORTS === 'undefined') {
    window.MDT_CAN_REDACT_REPORTS = Boolean(window.MDT_CAN_EDIT_REPORT_STATUS);
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function activeServiceCode() {
    return document.querySelector('.mdt-brand-title')?.textContent?.trim() || 'MDT';
  }

  function isCommandStaff() {
    return Boolean(window.MDT_CAN_EDIT_REPORT_STATUS);
  }

  function canEditCurrentReport() {
    const id = Number(document.querySelector('#reportId')?.value || 0);
    if (!id) return true;

    const ownerService = normalize(window.currentReportServiceCode || document.querySelector('#reportPdfSource')?.dataset.serviceCode || '');
    const activeService = normalize(activeServiceCode());
    const status = normalize(document.querySelector('#reportStatus')?.value || 'submitted');

    if (ownerService && activeService && ownerService !== activeService) return false;
    if (isCommandStaff()) return true;
    return status === 'draft';
  }

  function lockReason() {
    const ownerService = normalize(window.currentReportServiceCode || document.querySelector('#reportPdfSource')?.dataset.serviceCode || '');
    const activeService = normalize(activeServiceCode());
    const status = normalize(document.querySelector('#reportStatus')?.value || 'submitted');

    if (ownerService && activeService && ownerService !== activeService) return 'Ce rapport appartient à un autre service. Consultation uniquement.';
    if (status !== 'draft' && !isCommandStaff()) return 'Ce rapport est soumis. Les agents ne peuvent modifier que les brouillons. Les modifications sont réservées au Command Staff / Director du service propriétaire.';
    return 'Modification verrouillée.';
  }

  function ensureStatusSelector() {
    const existingSelector = document.querySelector('#reportStatusSelector');
    const existingLabel = existingSelector?.closest('label');

    if (!isCommandStaff()) {
      existingLabel?.remove();
      return;
    }

    const accessPanel = document.querySelector('[data-panel="access"] .report-form-grid');
    if (!accessPanel || existingSelector) return;

    const label = document.createElement('label');
    label.innerHTML = `Statut<select id="reportStatusSelector">
      <option value="draft">Brouillon</option>
      <option value="submitted">Soumis</option>
      <option value="validated">Validé</option>
      <option value="archived">Archivé</option>
      <option value="rejected">Rejeté</option>
    </select>`;
    accessPanel.prepend(label);

    const hidden = document.querySelector('#reportStatus');
    const selector = document.querySelector('#reportStatusSelector');
    selector.value = hidden?.value || 'submitted';
    selector.addEventListener('change', () => {
      if (hidden) hidden.value = selector.value;
      if (typeof renderDocument === 'function' && typeof payload === 'function') renderDocument(payload());
      setLockedUi();
    });
  }

  function syncStatusSelector() {
    ensureStatusSelector();
    if (!isCommandStaff()) return;
    const hidden = document.querySelector('#reportStatus');
    const selector = document.querySelector('#reportStatusSelector');
    if (hidden && selector) selector.value = hidden.value || 'submitted';
  }

  function setLockedUi() {
    const panel = document.querySelector('.report-panel-inner');
    if (!panel) return;

    const canEdit = canEditCurrentReport();
    panel.dataset.workflowLocked = canEdit ? '0' : '1';

    const saveButton = document.querySelector('#saveReportButton');
    const editButton = document.querySelector('#editReportButton');
    if (saveButton) saveButton.hidden = !canEdit;
    if (editButton && !canEdit) editButton.hidden = true;

    panel.querySelectorAll('input, textarea, select').forEach((field) => {
      const statusSelectorAllowed = field.id === 'reportStatusSelector' && isCommandStaff();
      if (statusSelectorAllowed) return;
      field.disabled = !canEdit;
    });

    panel.querySelectorAll('.rich-editor-surface').forEach((surface) => {
      surface.contentEditable = canEdit ? 'true' : 'false';
    });

    panel.querySelectorAll('.rich-editor-toolbar button').forEach((button) => {
      if (button.classList.contains('rich-editor-expand')) return;
      button.disabled = !canEdit;
    });

    let notice = panel.querySelector('#reportLockNotice');
    if (!canEdit) {
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'reportLockNotice';
        notice.className = 'report-lock-notice';
        document.querySelector('.report-document-header')?.insertAdjacentElement('afterend', notice);
      }
      notice.textContent = lockReason();
    } else {
      notice?.remove();
    }
  }

  function refresh() {
    syncStatusSelector();
    setLockedUi();
  }

  const observer = new MutationObserver(() => setTimeout(refresh, 0));
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.report-tab')) setTimeout(refresh, 0);
  });
  document.addEventListener('change', (event) => {
    if (['reportStatus', 'reportStatusSelector', 'reportType'].includes(event.target?.id)) setTimeout(refresh, 0);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 0));
  setTimeout(refresh, 0);
})();
