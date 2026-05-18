(() => {
  if (typeof window.MDT_CAN_REDACT_REPORTS === 'undefined') {
    window.MDT_CAN_REDACT_REPORTS = Boolean(window.MDT_CAN_EDIT_REPORT_STATUS);
  }
})();
