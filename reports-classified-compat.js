(() => {
  function normalizeMaskClass(value) {
    return String(value || '').replaceAll('mdt-rich-classified', 'mdt-rich-redacted');
  }

  function normalizeReportTextareas() {
    ['reportFacts', 'reportActionsTaken', 'reportConclusions', 'reportNotes'].forEach((id) => {
      const field = document.querySelector(`#${id}`);
      if (!field) return;
      const normalized = normalizeMaskClass(field.value);
      if (field.value !== normalized) field.value = normalized;
    });
  }

  const baseFillReport = window.fillReport;
  if (typeof baseFillReport === 'function') {
    window.fillReport = function fillReportWithClassifiedCompat(report = null, extra = {}) {
      const result = baseFillReport(report, extra);
      normalizeReportTextareas();
      window.MDTRichText?.refresh?.();
      return result;
    };
  }

  const basePayload = window.payload;
  if (typeof basePayload === 'function') {
    window.payload = function payloadWithClassifiedCompat() {
      normalizeReportTextareas();
      return basePayload();
    };
  }
})();
