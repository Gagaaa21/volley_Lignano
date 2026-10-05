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
      // Resta sullo schermo finché non viene aperta o chiusa: su computer
      // altrimenti sparirebbe dopo pochi secondi, magari mentre non si guarda.
      requireInteraction: true,
      // Su telefono fa vibrare, se il sistema lo permette.
      vibrate: [200, 100, 200],
      silent: false,
      timestamp: Date.now(),
    }),
  );
});

// Il browser a volte annulla o cambia l'iscrizione alle notifiche (scadenza,
// pulizia dei dati, risparmio energia): senza questo passaggio il sito
// continuerebbe a scrivere a un indirizzo ormai morto e l'utente smetterebbe
// di ricevere gli avvisi senza accorgersene. Qui si rinnova l'iscrizione e si
// comunica al sito il nuovo indirizzo; il sito riporta sul nuovo indirizzo
// squadra e account di quello vecchio.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldSubscription = event.oldSubscription || null;
        const current = await self.registration.pushManager.getSubscription();
        const key =
          (oldSubscription && oldSubscription.options && oldSubscription.options.applicationServerKey) ||
          (current && current.options && current.options.applicationServerKey);
        let subscription = event.newSubscription || current;
        if (!subscription && key) {
          subscription = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
        }
        if (!subscription) return;
        const json = subscription.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
            oldEndpoint: oldSubscription ? oldSubscription.endpoint : undefined,
            refresh: true,
          }),
        });
      } catch {
        // Si riprova alla prossima visita del sito (vedi PwaClient).
      }
    })(),
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
