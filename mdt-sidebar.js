(() => {
  function normalize(text) {
    return String(text || '').trim().toLowerCase();
  }

  function linkByText(labels) {
    const wanted = labels.map(normalize);
    return Array.from(document.querySelectorAll('.mdt-nav-link')).find((link) => wanted.includes(normalize(link.childNodes[0]?.textContent || link.textContent)));
  }

  function setLinkLabel(link, label) {
    if (!link) return;
    const badge = link.querySelector('.mdt-placeholder');
    link.textContent = label;
    if (badge) {
      link.append(' ');
      link.appendChild(badge);
    }
  }

  function ensureSeizuresLink() {
    const nav = document.querySelector('.mdt-nav');
    if (!nav || linkByText(['Saisies'])) return;

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'mdt-nav-link disabled';
    link.innerHTML = 'Saisies <span class="mdt-placeholder">Soon</span>';

    const reportsLink = linkByText(['Rapports']);
    if (reportsLink?.nextSibling) reportsLink.insertAdjacentElement('afterend', link);
    else nav.appendChild(link);
  }

  function normalizeNavigation() {
    setLinkLabel(linkByText(['Recherches']), 'Citoyens');
    setLinkLabel(linkByText(['Dispatch']), 'Effectifs');
    ensureSeizuresLink();

    const reports = linkByText(['Rapports']);
    if (reports && reports.getAttribute('href') === '#') {
      reports.href = '/reports.php';
      reports.classList.remove('disabled');
      reports.querySelector('.mdt-placeholder')?.remove();
    }
  }

  async function refreshSidebarStatus() {
    const footer = document.querySelector('.mdt-sidebar-footer');
    if (!footer) return;

    try {
      const response = await fetch('/api/sidebar-status.php', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) return;

      const strong = footer.querySelector('strong');
      const span = footer.querySelector('span');
      if (strong && result.username) strong.textContent = result.username;
      if (span) {
        span.innerHTML = `<i class="dispatch-status-dot mini ${result.status_class || 'status-unassigned'}"></i>${result.label || 'Non défini'}`;
      }
    } catch {
      // Silent fallback: keep PHP-rendered footer.
    }
  }

  function init() {
    normalizeNavigation();
    refreshSidebarStatus();
  }

  window.refreshSidebarStatus = refreshSidebarStatus;
  document.addEventListener('DOMContentLoaded', init);
  setTimeout(init, 0);
})();
