const CACHE_NAME = "lists-v18";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.registration.unregister())
     .then(() => self.clients.claim())
  );
});

// Do not intercept fetch to ensure the browser always reaches the network directly
// and never fails navigation requests with undefined responses.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action;
  const taskId = event.notification.data?.taskId;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (action && taskId) {
        for (const client of clientList) {
          client.postMessage({
            type: "NOTIFICATION_ACTION",
            action,
            taskId,
          });
        }
      }
      if (!action || action === "view") {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow("./");
      }
    })
  );
});
