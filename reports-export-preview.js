(() => {
  function filenameFromTitle() {
    const title = document.querySelector('#reportTitle')?.value?.trim()
      || document.querySelector('#reportTitleView')?.textContent?.trim()
      || 'rapport';

    return title.replace(/[^a-z0-9_-]+/gi, '_');
  }

  function openExportPreview(event) {
    const button = event.target.closest('#downloadReportButton');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (typeof window.renderDocument === 'function' && typeof window.payload === 'function') {
      window.renderDocument(window.payload());
    }

    const source = document.querySelector('#reportPdfSource');
    if (!source) return;

    const win = window.open('', '_blank');
    if (!win) return;

    const fileName = filenameFromTitle();
    const reportHtml = source.outerHTML;

    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #1f2937;
      font-family: Arial, sans-serif;
    }
    .export-toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      background: #0f172a;
      border-bottom: 1px solid #334155;
    }
    .export-toolbar button {
      border: 1px solid #475569;
      border-radius: 10px;
      background: #2563eb;
      color: #fff;
      font-weight: 800;
      padding: 9px 14px;
      cursor: pointer;
    }
    .export-toolbar button.secondary { background: #1e293b; }
    .export-page {
      width: 210mm;
      min-height: 297mm;
      margin: 18px auto;
      background: #d7d7d7;
      padding: 8mm;
      box-shadow: 0 18px 50px rgba(0,0,0,.45);
    }
    .fib-report-template {
      width: 100% !important;
      height: 281mm !important;
      min-height: 0 !important;
      max-height: 281mm !important;
      margin: 0 !important;
      padding: 8mm !important;
      overflow: hidden !important;
      background: #d7d7d7;
      color: #111;
      font-family: Arial, sans-serif;
      border: 1px solid #111;
      box-shadow: none !important;
    }
    .fib-template-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #111;
      padding: 8px 24px;
    }
    .fib-template-header em {
      font-family: Georgia, serif;
      font-size: 20pt;
    }
    .fib-template-header strong {
      display: block;
      width: 78mm;
      border: 1px solid #111;
      padding: 4px;
      margin-top: 6px;
      font-size: 20pt;
    }
    .fib-template-logo {
      width: 26mm !important;
      height: 26mm !important;
      min-width: 26mm !important;
      min-height: 26mm !important;
      max-width: 26mm !important;
      max-height: 26mm !important;
      border: 2px solid #111;
      border-radius: 50%;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #1f2937;
      color: #fff;
      font-weight: 900;
    }
    .fib-template-logo img {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .fib-template-grid { display: grid; border: 1px solid #111; border-top: 0; }
    .fib-template-grid.three { grid-template-columns: 1fr 1fr 1fr; }
    .fib-template-grid.two { grid-template-columns: 2fr 1fr; }
    .fib-template-grid > div { padding: 5px; border-right: 1px solid #111; }
    .fib-template-grid > div:last-child { border-right: 0; }
    .fib-template-row, .fib-template-block { border: 1px solid #111; border-top: 0; padding: 5px; }
    .fib-report-template span { display: block; font-weight: 900; font-size: 9pt; margin-bottom: 4px; }
    .fib-report-template strong { display: block; border: 1px solid #111; padding: 4px; min-height: 18px; background: rgba(255,255,255,.12); }
    .fib-template-block p {
      border: 1px solid #111;
      margin: 0;
      padding: 6px;
      white-space: pre-wrap;
      background: rgba(255,255,255,.08);
      font-size: 10pt;
      line-height: 1.18;
    }
    .fib-template-block p { min-height: 93mm; }
    .fib-template-block.small p { min-height: 18mm; }
    .fib-template-block.signature p { min-height: 22mm; }
    .arrestation-document-template {
      padding: 6mm !important;
      font-size: 9.2pt;
    }
    .arrestation-document-template .fib-template-header {
      padding: 6px 18px;
    }
    .arrestation-document-template .fib-template-header em {
      font-size: 18pt;
    }
    .arrestation-document-template .fib-template-header strong {
      width: 118mm;
      font-size: 17pt;
    }
    .arrestation-document-template .fib-template-logo {
      width: 23mm !important;
      height: 23mm !important;
      min-width: 23mm !important;
      min-height: 23mm !important;
      max-width: 23mm !important;
      max-height: 23mm !important;
    }
    .arrestation-document-template .fib-template-grid.two { grid-template-columns: 2fr 1fr; }
    .arrestation-document-template .fib-template-grid.three { grid-template-columns: 1fr 1fr 1fr; }
    .arrestation-document-template .fib-template-grid > div,
    .arrestation-document-template .fib-template-block {
      padding: 4px;
    }
    .arrestation-document-template .fib-template-grid strong {
      min-height: 18px;
      font-size: 8.8pt;
    }
    .arrestation-document-template .charge-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      border: 1px solid #111;
      margin: 0;
      padding: 4px;
      min-height: 19mm;
      background: rgba(255,255,255,.08);
    }
    .arrestation-document-template .charge-grid strong {
      min-height: 17px;
      border: 1px solid #111;
      background: rgba(255,255,255,.14);
      padding: 3px;
      font-size: 8.5pt;
    }
    .arrestation-document-template .arrestation-story p {
      min-height: 56mm;
      font-size: 9pt;
      line-height: 1.12;
    }
    .arrestation-document-template .fib-template-block.small p {
      min-height: 12mm;
    }
    .arrestation-document-template .fib-template-grid.two:last-child strong {
      min-height: 14mm;
    }
    @media print {
      body { background: #d7d7d7; }
      .export-toolbar { display: none !important; }
      .export-page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
      .fib-report-template {
        width: 194mm !important;
        height: 281mm !important;
      }
    }
  </style>
</head>
<body>
  <div class="export-toolbar">
    <button type="button" onclick="window.print()">Télécharger / enregistrer en PDF</button>
    <button type="button" class="secondary" onclick="window.close()">Fermer</button>
  </div>
  <main class="export-page">${reportHtml}</main>
</body>
</html>`);

    win.document.close();
  }

  document.addEventListener('click', openExportPreview, true);
})();
