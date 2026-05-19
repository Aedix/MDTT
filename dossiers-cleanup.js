(() => {
  function cleanDots() {
    document.querySelectorAll('.dossier-item .item-menu, .dossier-item .folder-logo-badge').forEach((node) => node.remove());
    document.querySelectorAll('.dossiers-detail-panel .detail-actions-mini button:not(#favoriteButton)').forEach((node) => node.remove());
    document.querySelectorAll('.detail-footer-actions button').forEach((button) => {
      if (button.title === 'Plus' || button.textContent.trim() === '⋮') button.remove();
    });
  }

  function syncFavorite() {
    const favoriteButton = document.querySelector('#favoriteButton');
    if (!favoriteButton) return;
    const isFavorite = favoriteButton.textContent.includes('★');
    favoriteButton.classList.toggle('is-favorite', isFavorite);
    favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    favoriteButton.title = isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris';

    document.querySelectorAll('.dossier-item strong').forEach((strong) => {
      if (!strong.textContent.includes('★')) return;
      const cleanTitle = strong.textContent.replace('★', '').trim();
      strong.innerHTML = `${cleanTitle} <span class="favorite-star">★</span>`;
      strong.closest('.dossier-item')?.classList.add('is-favorite-card');
    });
  }

  function runCleanup() {
    cleanDots();
    syncFavorite();
  }

  const observer = new MutationObserver(runCleanup);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  document.addEventListener('DOMContentLoaded', runCleanup);
  document.addEventListener('click', () => setTimeout(runCleanup, 80));
  setInterval(runCleanup, 900);
  runCleanup();
})();
