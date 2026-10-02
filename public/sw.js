self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Nessuna cache offline qui: è solo un passthrough (serve a far risultare
  // l'app installabile). Senza il catch, un fetch fallito per un intoppo di
  // rete (schermo appena riacceso, passaggio tra reti) rigetta la promise
  // passata a respondWith, e Safari mostra al suo posto una pagina di
  // errore nativa fuorviante ("FetchEvent.respondWith received an error")
  // invece del sito.
  event.respondWith(
    fetch(event.request).catch(
      () => new Response("Connessione assente. Riprova.", { status: 503, statusText: "Rete non disponibile" }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Volley Lignano", body: "Il calendario è stato aggiornato." };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
