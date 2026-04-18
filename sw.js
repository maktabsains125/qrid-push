self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {};
  }

  const title = data.title || "Greeting duty reminder";
  const body = data.body || "Check your schedule for today.";
  const url = data.url || "/shared/camera/greetings/bookings.html";
  const tag = data.tag || "greeting-duty-today";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "shared/icons/notification192.png",
      badge: "/homescreen512.png",
      data: { url },
      tag,
      renotify: true
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/shared/camera/greetings/bookings.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (
          client.url &&
          client.url.includes("/shared/camera/greetings")
        ) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return Promise.resolve();
    })
  );
});
