(() => {
  function filenameFromTitle() {
    const title = document.querySelector('#reportTitle')?.value?.trim() || document.querySelector('#reportTitleView')?.textContent?.trim() || 'rapport';
    return `${title.replace(/[^a-z0-9_-]+/gi, '_')}.pdf`;
  }

  function preparePdfClone() {
    const source = document.querySelector('#reportPdfSource');
    if (!source) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'report-pdf-export-wrapper';
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-10000px';
    wrapper.style.top = '0';
    wrapper.style.width = '794px';
    wrapper.style.height = '1123px';
    wrapper.style.overflow = 'hidden';
    wrapper.style.background = '#d7d7d7';
    wrapper.style.zIndex = '-1';

    const clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.width = '794px';
    clone.style.height = '1123px';
    clone.style.minHeight = '0';
    clone.style.maxHeight = '1123px';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.style.boxSizing = 'border-box';
    clone.style.overflow = 'hidden';

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    return wrapper;
  }

  async function downloadCleanPdf(event) {
    const button = event.target.closest('#downloadReportButton');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (typeof html2pdf === 'undefined') {
      alert('Le module PDF n’est pas encore chargé. Recharge la page et réessaie.');
      return;
    }

    const wrapper = preparePdfClone();
    if (!wrapper) return;

    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: filenameFromTitle(),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
            backgroundColor: '#d7d7d7',
            windowWidth: 794,
            windowHeight: 1123,
          },
          jsPDF: {
            unit: 'px',
            format: [794, 1123],
            orientation: 'portrait',
            compress: true,
          },
          pagebreak: { mode: ['avoid-all'] },
        })
        .from(wrapper.firstElementChild)
        .save();
    } finally {
      wrapper.remove();
    }
  }

  document.addEventListener('click', downloadCleanPdf, true);
})();
