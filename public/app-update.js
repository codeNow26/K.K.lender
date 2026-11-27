/* Production release check. No storage, session or calendar data is cleared. */
(() => {
  const release = document.querySelector('meta[name="kklender-release"]')?.content;
  if (!/^[a-f0-9]{40}$/.test(release || '')) return;
  let checking = false;
  let navigating = false;
  const isEditing = () => !!document.querySelector('.event-form') ||
    Array.from(document.querySelectorAll('.login-form input')).some(input => input.value);
  const check = async () => {
    if (checking || navigating || document.hidden || isEditing()) return;
    checking = true;
    try {
      const endpoint = new URL('app-version.json', document.baseURI);
      endpoint.searchParams.set('check', String(Date.now()));
      const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) return;
      const { version } = await response.json();
      if (!/^[a-f0-9]{40}$/.test(version || '') || version === release || document.hidden || isEditing()) return;
      const next = new URL(location.href);
      // A stale intermediary must not cause an endless redirect.
      if (next.searchParams.get('__release') === version) return;
      next.searchParams.set('__release', version);
      navigating = true;
      location.replace(next.href);
    } catch { /* Offline? Keep the current calendar usable and retry next time. */ }
    finally { checking = false; }
  };
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 60000);
  void check();
})();
