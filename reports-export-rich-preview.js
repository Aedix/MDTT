(() => {
  function filenameFromTitle() {
    const title = document.querySelector('#reportTitle')?.value?.trim()
      || document.querySelector('#reportTitleView')?.textContent?.trim()
      || 'rapport';

    return title.replace(/[^a-z0-9_-]+/gi, '_');
  }

  function openRichExportPreview(event) {
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
    body { margin: 0; background: #1f2937; font-family: Arial, sans-serif; }
    .export-toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: center; gap: 10px; padding: 12px; background: #0f172a; border-bottom: 1px solid #334155; }
    .export-toolbar button { border: 1px solid #475569; border-radius: 10px; background: #2563eb; color: #fff; font-weight: 800; padding: 9px 14px; cursor: pointer; }
    .export-toolbar button.secondary { background: #1e293b; }
    .export-page { width: 210mm; min-height: 297mm; margin: 18px auto; background: #d7d7d7; padding: 8mm; box-shadow: 0 18px 50px rgba(0,0,0,.45); }

    .fib-report-template { width: 100% !important; height: 281mm !important; min-height: 0 !important; max-height: 281mm !important; margin: 0 !important; padding: 7mm !important; overflow: hidden !important; background: #d7d7d7; color: #111; font-family: Arial, sans-serif; border: 1px solid #111; box-shadow: none !important; }
    .fib-template-header { display: flex; justify-content: space-between; align-items: center; border: 1px solid #111; padding: 7px 20px; }
    .fib-template-header em { font-family: Georgia, serif; font-size: 18pt; }
    .fib-template-header strong { display: block; width: 82mm; border: 1px solid #111; padding: 4px; margin-top: 5px; font-size: 18pt; }
    .fib-template-logo { width: 24mm !important; height: 24mm !important; min-width: 24mm !important; min-height: 24mm !important; max-width: 24mm !important; max-height: 24mm !important; border: 2px solid #111; border-radius: 50%; display: grid; place-items: center; overflow: hidden; background: #1f2937; color: #fff; font-weight: 900; }
    .fib-template-logo img { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; }
    .fib-template-grid { display: grid; border: 1px solid #111; border-top: 0; }
    .fib-template-grid.three { grid-template-columns: 1fr 1fr 1fr; }
    .fib-template-grid.two { grid-template-columns: 2fr 1fr; }
    .fib-template-grid > div { padding: 4px; border-right: 1px solid #111; min-width: 0; }
    .fib-template-grid > div:last-child { border-right: 0; }
    .fib-template-row, .fib-template-block { border: 1px solid #111; border-top: 0; padding: 4px; }
    .fib-report-template span { font-weight: inherit; font-size: inherit; margin-bottom: 0; }
    .fib-report-template > .fib-template-grid span,
    .fib-report-template > .fib-template-row span,
    .fib-report-template > .fib-template-block > span { display: block; font-weight: 900; font-size: 8.4pt; margin-bottom: 3px; }
    .fib-report-template strong { display: block; border: 1px solid #111; padding: 3px 4px; min-height: 17px; background: rgba(255,255,255,.12); font-size: 8.8pt; overflow-wrap: anywhere; }
    .fib-template-rich strong { display: inline; border: 0; padding: 0; min-height: 0; background: transparent; font-size: inherit; }
    .fib-template-block p, .fib-template-rich { border: 1px solid #111; margin: 0; padding: 5px; background: rgba(255,255,255,.08); font-size: 8.8pt; line-height: 1.15; }
    .fib-template-block p { white-space: pre-wrap; min-height: 80mm; }
    .fib-template-rich { min-height: 80mm; white-space: normal; }
    .fib-template-rich p { margin: 0 0 5px; }
    .fib-template-rich ul, .fib-template-rich ol { margin: 0 0 5px; padding-left: 16px; }
    .fib-template-rich li { margin: 0 0 2px; }
    .fib-template-block.small p, .fib-template-block.small .fib-template-rich { min-height: 14mm; }
    .fib-template-block.signature p, .fib-template-block.signature .fib-template-rich { min-height: 18mm; }

    .mdt-rich-color-red { color: #b91c1c; }
    .mdt-rich-color-orange { color: #c2410c; }
    .mdt-rich-color-yellow { color: #a16207; }
    .mdt-rich-color-green { color: #15803d; }
    .mdt-rich-color-blue { color: #1d4ed8; }
    .mdt-rich-color-purple { color: #7e22ce; }
    .mdt-rich-highlight-yellow { background: rgba(250, 204, 21, .48); color: inherit; padding: 0 2px; border-radius: 2px; }
    .mdt-rich-highlight-green { background: rgba(34, 197, 94, .32); color: inherit; padding: 0 2px; border-radius: 2px; }
    .mdt-rich-highlight-blue { background: rgba(59, 130, 246, .32); color: inherit; padding: 0 2px; border-radius: 2px; }
    .mdt-rich-highlight-red { background: rgba(239, 68, 68, .34); color: inherit; padding: 0 2px; border-radius: 2px; }

    .arrestation-document-template { padding: 5.5mm !important; font-size: 8.8pt; }
    .arrestation-document-template .fib-template-header { padding: 5px 16px; }
    .arrestation-document-template .fib-template-header em { font-size: 17pt; }
    .arrestation-document-template .fib-template-header strong { width: 118mm; font-size: 16pt; }
    .arrestation-document-template .fib-template-logo { width: 22mm !important; height: 22mm !important; min-width: 22mm !important; min-height: 22mm !important; max-width: 22mm !important; max-height: 22mm !important; }
    .arrestation-document-template .arrestation-admin-grid { grid-template-columns: 1.25fr 1fr 1fr; }
    .arrestation-document-template .arrestation-linked-grid { grid-template-columns: 1.35fr .9fr; }
    .arrestation-document-template .arrestation-decision-grid { grid-template-columns: 1.5fr .8fr; }
    .arrestation-document-template .charge-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border: 1px solid #111; margin: 0; padding: 4px; min-height: 18mm; background: rgba(255,255,255,.08); }
    .arrestation-document-template .charge-grid strong { min-height: 16px; border: 1px solid #111; background: rgba(255,255,255,.14); padding: 3px; font-size: 8.2pt; }
    .arrestation-document-template .arrestation-story .fib-template-rich { min-height: 52mm; font-size: 8.7pt; line-height: 1.12; }
    .arrestation-document-template .fib-template-block.small p { min-height: 10mm; }
    .arrestation-document-template .arrestation-decision-grid strong { min-height: 13mm; }

    @media print { body { background: #d7d7d7; } .export-toolbar { display: none !important; } .export-page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; } .fib-report-template { width: 194mm !important; height: 281mm !important; } }
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

  window.addEventListener('click', openRichExportPreview, true);
})();
