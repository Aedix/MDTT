(() => {
  function params() {
    return new URLSearchParams(window.location.search);
  }

  function clearDeepLink() {
    const url = new URL(window.location.href);
    url.searchParams.delete('citizen_id');
    url.searchParams.delete('vehicle_id');
    window.history.replaceState({}, '', url.toString());
  }

  function waitForCitizen(id, attempts = 40) {
    const target = Number(id || 0);
    if (!target) return;

    const row = document.querySelector(`.citizen-row[data-id="${target}"]`);
    if (row && typeof loadCitizen === 'function') {
      loadCitizen(target).then(() => {
        const vehicleId = Number(params().get('vehicle_id') || 0);
        if (vehicleId) {
          setTimeout(() => {
            document.querySelector('.citizen-tab[data-tab="vehicles"]')?.click();
            const vehicle = Array.from(document.querySelectorAll('[data-vehicle]')).find((item) => {
              try { return Number(JSON.parse(item.dataset.vehicle || '{}').id) === vehicleId; } catch { return false; }
            });
            vehicle?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            vehicle?.classList.add('deep-linked-record');
          }, 350);
        }
        clearDeepLink();
      });
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (attempts > 0) setTimeout(() => waitForCitizen(target, attempts - 1), 150);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const id = Number(params().get('citizen_id') || 0);
    if (id) waitForCitizen(id);
  });

  setTimeout(() => {
    const id = Number(params().get('citizen_id') || 0);
    if (id) waitForCitizen(id);
  }, 500);
})();
