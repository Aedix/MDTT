(() => {
  function activeServiceCode() {
    return document.querySelector('.mdt-brand-title')?.textContent?.trim() || 'MDT';
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
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

  function reason() {
    const ownerService = normalize(window.currentReportServiceCode || document.querySelector('#reportPdfSource')?.dataset.serviceCode || '');
    const activeService = normalize(activeServiceCode());
    const status = normalize(document.querySelector('#reportStatus')?.value || 'submitted');

    if (ownerService && activeService && ownerService !== activeService) {
      return 'Ce rapport appartient à un autre service. Consultation uniquement.';
    }

    if (status !== 'draft' && !isCommandStaff()) {
      return 'Ce rapport est soumis. Les agents ne peuvent modifier que les brouillons. Les modifications sont réservées au Command Staff / Director du service propriétaire.';
    }

    return 'Modification verrouillée.';
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

    const fields = panel.querySelectorAll('input, textarea, select');
    fields.forEach((field) => {
      const alwaysAllowed = ['reportSearchInput'].includes(field.id);
      const statusSelectorAllowed = field.id === 'reportStatusSelector' && isCommandStaff();
      if (alwaysAllowed || statusSelectorAllowed) return;
      field.disabled = !canEdit;
    });

    panel.querySelectorAll('.rich-editor-surface').forEach((surface) => {
      surface.contentEditable = canEdit ? 'true' : 'false';
    });

    panel.querySelectorAll('.rich-editor-toolbar button').forEach((button) => {
      const isExpand = button.classList.contains('rich-editor-expand');
      if (isExpand) return;
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
      notice.textContent = reason();
    } else {
      notice?.remove();
    }
  }

  const observer = new MutationObserver(() => setTimeout(setLockedUi, 0));
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', (event) => {
    if (['reportStatus', 'reportStatusSelector', 'reportType'].includes(event.target?.id)) setTimeout(setLockedUi, 0);
  }, true);
  document.addEventListener('DOMContentLoaded', () => setTimeout(setLockedUi, 0));
  setTimeout(setLockedUi, 0);
})();
