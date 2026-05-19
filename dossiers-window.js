(() => {
  const configs = [
    { panel: '#dossiersDrawer', handle: '.dossiers-drawer-header' },
    { panel: '#dossiersModal', handle: '.dossiers-modal-header' },
    { panel: '.dossiers-confirm', handle: 'h3' },
  ];

  const margin = 10;
  const state = new WeakMap();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function isInteractiveTarget(target) {
    return Boolean(target.closest('button, input, textarea, select, a, label, [data-close-drawer], [data-close-modal], [data-confirm-cancel], [data-confirm-ok]'));
  }

  function applySavedPosition(panel) {
    const saved = state.get(panel);
    if (!saved) return;

    const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
    const left = clamp(saved.left, margin, maxLeft);
    const top = clamp(saved.top, margin, maxTop);

    panel.style.position = 'fixed';
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.margin = '0';
    panel.style.transform = 'none';
    panel.style.zIndex = '120';
    state.set(panel, { left, top });
  }

  function makeDraggable(panel, handle) {
    if (!panel || !handle || panel.dataset.dragReady === '1') return;
    panel.dataset.dragReady = '1';
    handle.classList.add('is-draggable-handle');

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return;

      const rect = panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      panel.style.position = 'fixed';
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      panel.style.margin = '0';
      panel.style.transform = 'none';
      panel.style.zIndex = '120';
      panel.classList.add('is-dragging-window');
      handle.setPointerCapture?.(event.pointerId);

      const onMove = (moveEvent) => {
        const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
        const maxTop = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
        const left = clamp(moveEvent.clientX - offsetX, margin, maxLeft);
        const top = clamp(moveEvent.clientY - offsetY, margin, maxTop);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        state.set(panel, { left, top });
      };

      const onUp = () => {
        panel.classList.remove('is-dragging-window');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
  }

  function initDragTargets() {
    configs.forEach((config) => {
      document.querySelectorAll(config.panel).forEach((panel) => {
        const handle = panel.querySelector(config.handle);
        makeDraggable(panel, handle);
        if (!panel.hidden) applySavedPosition(panel);
      });
    });
  }

  const observer = new MutationObserver(initDragTargets);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });

  window.addEventListener('resize', () => {
    configs.forEach((config) => {
      document.querySelectorAll(config.panel).forEach(applySavedPosition);
    });
  });

  document.addEventListener('DOMContentLoaded', initDragTargets);
  initDragTargets();
})();
