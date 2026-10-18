// Service worker di Minivolley (Volley S3): stesso comportamento di /sw.js, ma registrato solo per «/minivolley». Serve a
// una cosa precisa: il browser dà una sola iscrizione alle notifiche per service worker, quindi con un worker per squadra
// ogni dispositivo può avere le notifiche di U14/U15 (worker di «/») e quelle di Minivolley (questo) distinte l'una
// dall'altra. Vedi src/lib/pwa/teamPush.ts.
importScripts("/sw.js");
