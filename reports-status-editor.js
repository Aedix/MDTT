(() => {
  function canEditStatus() {
    return Boolean(window.MDT_CAN_EDIT_REPORT_STATUS);
  }

  function ensureStatusSelector() {
    const existingSelector = document.querySelector('#reportStatusSelector');
    const existingLabel = existingSelector?.closest('label');

    if (!canEditStatus()) {
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
    });
  }

  function syncStatusSelector() {
    ensureStatusSelector();
    if (!canEditStatus()) return;

    const hidden = document.querySelector('#reportStatus');
    const selector = document.querySelector('#reportStatusSelector');
    if (hidden && selector) selector.value = hidden.value || 'submitted';
  }

  const observer = new MutationObserver(syncStatusSelector);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.report-tab')) setTimeout(syncStatusSelector, 0);
  });
})();
