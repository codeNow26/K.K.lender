/* Push-only worker: no caching or interception of calendar requests. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification('K.K.Lender – Inselpost', {
    body: typeof payload.body === 'string' ? payload.body : 'Ein neuer Inselplan wartet auf dich!',
    icon: new URL('icons/android-chrome-192x192.png', self.registration.scope).href,
    tag: typeof payload.id === 'string' ? 'event-' + payload.id : 'island-event'
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
