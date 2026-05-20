(() => {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.includes('/api/dossiers.php') && url.includes('action=list')) {
        const absolute = new URL(url, window.location.origin);
        const view = absolute.searchParams.get('view');
        if (['shared', 'recent', 'favorite'].includes(view)) {
          absolute.pathname = '/api/dossiers_views.php';
          absolute.searchParams.delete('action');
          return nativeFetch(absolute.toString(), init);
        }
      }
    } catch (error) {}

    return nativeFetch(input, init);
  };
})();
