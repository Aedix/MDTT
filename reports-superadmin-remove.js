(() => {
  let canRemoveReports = Boolean(window.MDT_CAN_REMOVE_REPORTS);

  async function apiJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide.'); }
    if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
    return result;
  }

  async function loadCapability() {
    try {
      const result = await apiJson('/api/report-remove.php');
      canRemoveReports = Boolean(result.can_remove_reports || window.MDT_CAN_REMOVE_REPORTS);
    } catch {
      canRemoveReports = Boolean(window.MDT_CAN_REMOVE_REPORTS);
    }
    refreshRemoveButton();
  }

  function selectedReportIdValue() {
    return Number(document.querySelector('#reportId')?.value || 0);
  }

  function bindRemoveButton(button) {
    if (!button || button.dataset.bound === '1') return;
    button.dataset.bound = '1';

    button.addEventListener('click', async () => {
      const reportId = selectedReportIdValue();
      if (!reportId || !canRemoveReports) return;
      const title = document.querySelector('#reportTitleView')?.textContent?.trim() || 'ce rapport';
      const ok = confirm(`Supprimer définitivement ${title} ?`);
      if (!ok) return;

      try {
        await apiJson('/api/report-remove.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: reportId }),
        });

        selectedReportId = null;
        reportPanel.innerHTML = '<div class="report-empty-state"><p class="mdt-kicker">Rapport</p><h3>Rapport supprimé</h3><p>Sélectionne ou crée un autre rapport.</p></div>';
        await loadReports();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function ensureRemoveButton() {
    const actions = document.querySelector('.report-actions');
    if (!actions) return null;

    let button = document.querySelector('#removeReportButton');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'removeReportButton';
      button.className = 'mdt-button-danger report-delete-button';
      button.title = 'Supprimer le rapport';
      button.textContent = 'Supprimer';
      actions.appendChild(button);
    }

    bindRemoveButton(button);
    return button;
  }

  function refreshRemoveButton() {
    const button = ensureRemoveButton();
    if (!button) return;
    button.hidden = !(canRemoveReports && selectedReportIdValue() > 0);
  }

  const observer = new MutationObserver(refreshRemoveButton);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('input', refreshRemoveButton, true);
  document.addEventListener('click', () => setTimeout(refreshRemoveButton, 0), true);
  loadCapability();
})();
