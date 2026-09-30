// Service worker : reçoit les notifications (Web Push) et ouvre la bonne page au clic.
// Volontairement SANS cache : le site reste toujours à jour.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "Espace cours", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Espace cours", {
    body: d.body || "",
    icon: "assets/icon-192.png",
    badge: "assets/badge-96.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const same = all.find(c => new URL(c.url).pathname === new URL(url).pathname);
    if (same) { await same.focus(); try { await same.navigate(url); } catch (err) {} return; }
    await self.clients.openWindow(url);
  })());
});
