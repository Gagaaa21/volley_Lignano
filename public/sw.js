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
      // Due avvisi con lo stesso tag si sostituiscono: serve a non far comparire due volte lo stesso avviso a chi ha attive
      // le notifiche di tutte e due le squadre sullo stesso dispositivo (vedi notifyAdmins).
      tag: payload.tag || undefined,
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

// Quale finestra già aperta può ricevere la notifica. Gli avvisi U14/U15 puntano a «/»: con il vecchio confronto
// («l'indirizzo contiene...») qualunque finestra andava bene, e si tirava in primo piano anche l'app di Minivolley, che sta
// sotto «/minivolley». Ora U14/U15 e Minivolley si tengono separati; i link dell'area riservata vogliono la stessa pagina.
function isMinivolley(url) {
  return url.pathname === "/minivolley" || url.pathname.startsWith("/minivolley/");
}

function canShow(clientUrl, target) {
  let client;
  try {
    client = new URL(clientUrl);
  } catch {
    return false;
  }
  if (client.origin !== target.origin) return false;
  if (isMinivolley(target)) return isMinivolley(client);
  if (target.pathname === "/") return !isMinivolley(client);
  return client.pathname === target.pathname;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (canShow(client.url, target) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target.href);
    }),
  );
});
