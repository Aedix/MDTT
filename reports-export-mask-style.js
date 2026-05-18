(() => {
  function ensureMaskStyles() {
    const source = document.querySelector('#reportPdfSource');
    if (!source || source.querySelector('#richMaskExportStyles')) return;

    const maskClass = 'mdt-rich-' + 'classified';
    const legacyMaskClass = 'mdt-rich-' + 'redacted';
    const style = document.createElement('style');
    style.id = 'richMaskExportStyles';
    style.textContent = `.${maskClass},.${legacyMaskClass}{display:inline-block;min-width:4.5em;min-height:1em;background:#050505;color:transparent!important;border-radius:2px;vertical-align:-0.12em;user-select:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);}`;
    source.prepend(style);
  }

  window.addEventListener('click', (event) => {
    if (event.target.closest('#downloadReportButton')) ensureMaskStyles();
  }, true);
})();
