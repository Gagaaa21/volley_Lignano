/**
 * PARTITE VOLLEY LIGNANO → IL TUO GOOGLE CALENDAR (solo tuo, sempre aggiornato)
 *
 * Cosa fa: ogni 5 minuti legge le partite U14 e U15 dal sito e le scrive in un calendario
 * «Partite Volley Lignano» del TUO Google Calendar: aggiunge le nuove, aggiorna orario,
 * palestra e risultato di quelle cambiate, toglie quelle cancellate. Tocca solo quel
 * calendario, mai gli altri tuoi impegni. Il sito non vede niente del tuo account Google:
 * è il tuo account che legge il calendario pubblico del sito.
 *
 * COME SI ATTIVA (una volta sola, dal computer):
 *  1. Apri https://script.google.com e premi «Nuovo progetto».
 *  2. Cancella il testo che c'è, incolla tutto questo file e salva (icona del dischetto).
 *  3. In alto, nell'elenco delle funzioni, scegli «attiva» e premi «Esegui».
 *  4. Google chiede il permesso: «Rivedi autorizzazioni» → scegli il tuo account →
 *     «Avanzate» → «Vai a Progetto senza titolo (non sicuro)» → «Consenti».
 *     («Non verificato» solo perché lo script è tuo e non è pubblicato da nessuna parte.)
 * Fatto: il calendario «Partite Volley Lignano» compare in Google Calendar, sul computer e sul
 * telefono. Da lì puoi sceglierne il colore e le notifiche come per ogni altro calendario.
 *
 * PER FERMARLO: scegli «disattiva» e premi «Esegui» (il calendario resta, non si aggiorna più).
 */

var FEED_URL = 'https://volley-lignano.vercel.app/calendario.ics?solo=partite';
var CALENDAR_NAME = 'Partite Volley Lignano';
var TIME_ZONE = 'Europe/Rome';
var TAG = 'volleyLignanoUid';
var EVERY_MINUTES = 5;
/** Anche se le partite non cambiano, ogni 6 ore si ricontrolla tutto (rimette a posto un evento toccato a mano). */
var FULL_CHECK_MS = 6 * 60 * 60 * 1000;
var DAY_MS = 24 * 60 * 60 * 1000;

/** Da eseguire una volta: accende l'aggiornamento ogni 5 minuti e sincronizza subito. */
function attiva() {
  disattiva();
  ScriptApp.newTrigger('sincronizza').timeBased().everyMinutes(EVERY_MINUTES).create();
  PropertiesService.getScriptProperties().deleteProperty('lastHash');
  sincronizza();
}

/** Spegne l'aggiornamento automatico (il calendario resta com'è). */
function disattiva() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sincronizza') ScriptApp.deleteTrigger(trigger);
  });
}

/** Legge le partite dal sito e mette il calendario uguale. La chiama da sola l'attivazione, ogni 5 minuti. */
function sincronizza() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // ne sta già girando una
  try {
    var response = UrlFetchApp.fetch(FEED_URL, { muteHttpExceptions: true, followRedirects: true });
    var text = response.getResponseCode() === 200 ? response.getContentText('UTF-8') : '';
    if (text.indexOf('BEGIN:VCALENDAR') === -1) {
      // Sito irraggiungibile o risposta strana: non si tocca niente, si riprova al giro dopo.
      console.warn('Calendario del sito non disponibile (codice ' + response.getResponseCode() + '): riprovo tra poco.');
      return;
    }
    var props = PropertiesService.getScriptProperties();
    var hash = fingerprint(text);
    var lastFull = Number(props.getProperty('lastFullCheck') || 0);
    var now = new Date();
    if (props.getProperty('lastHash') === hash && now.getTime() - lastFull < FULL_CHECK_MS) return; // niente di nuovo

    var result = applyFeed(getCalendar(), parseIcs(text), now);
    props.setProperty('lastHash', hash);
    props.setProperty('lastFullCheck', String(now.getTime()));
    console.log('Partite: ' + result.created + ' aggiunte, ' + result.updated + ' aggiornate, ' + result.deleted + ' tolte.');
  } finally {
    lock.releaseLock();
  }
}

/** Il calendario «Partite Volley Lignano»: quello già creato, o uno nuovo (anche se lo hai cancellato). */
function getCalendar() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('calendarId');
  var calendar = id ? CalendarApp.getCalendarById(id) : null;
  if (!calendar) {
    var owned = CalendarApp.getOwnedCalendarsByName(CALENDAR_NAME);
    calendar =
      owned.length > 0
        ? owned[0]
        : CalendarApp.createCalendar(CALENDAR_NAME, {
            summary: 'Le partite U14 e U15 del Volley Lignano, aggiornate dal sito ogni 5 minuti.',
            timeZone: TIME_ZONE,
          });
    props.setProperty('calendarId', calendar.getId());
  }
  return calendar;
}

/**
 * Mette il calendario uguale alle partite lette dal sito. Si guardano solo gli eventi con la
 * nostra etichetta (TAG), dentro la finestra che il sito manda (un anno indietro, uno avanti).
 */
function applyFeed(calendar, feed, now) {
  var from = new Date(now.getTime() - 360 * DAY_MS);
  var to = new Date(now.getTime() + 400 * DAY_MS);
  var result = { created: 0, updated: 0, deleted: 0 };

  var byUid = {};
  calendar.getEvents(from, to).forEach(function (event) {
    var uid = event.getTag(TAG);
    if (!uid) return;
    if (byUid[uid]) {
      event.deleteEvent(); // un doppione: ne basta uno
      result.deleted++;
      return;
    }
    byUid[uid] = event;
  });

  var seen = {};
  feed.forEach(function (item) {
    if (item.start < from || item.start > to) return;
    seen[item.uid] = true;
    var end = item.end && item.end > item.start ? item.end : new Date(item.start.getTime() + 2 * 60 * 60 * 1000);
    var title = item.title || 'Partita';
    var location = item.location || '';
    var description = item.description || '';
    var event = byUid[item.uid];
    if (!event) {
      event = calendar.createEvent(title, item.start, end, { location: location, description: description });
      event.setTag(TAG, item.uid);
      result.created++;
      return;
    }
    var changed = false;
    if (event.getTitle() !== title) {
      event.setTitle(title);
      changed = true;
    }
    if (event.getStartTime().getTime() !== item.start.getTime() || event.getEndTime().getTime() !== end.getTime()) {
      event.setTime(item.start, end);
      changed = true;
    }
    if (event.getLocation() !== location) {
      event.setLocation(location);
      changed = true;
    }
    if (normalize(event.getDescription()) !== normalize(description)) {
      event.setDescription(description);
      changed = true;
    }
    if (changed) result.updated++;
  });

  if (Object.keys(seen).length === 0 && Object.keys(byUid).length > 0) {
    // Il sito non ha mandato nessuna partita: per prudenza non si cancella niente.
    console.warn('Nessuna partita dal sito: non tolgo niente dal calendario.');
    return result;
  }
  Object.keys(byUid).forEach(function (uid) {
    if (seen[uid]) return;
    byUid[uid].deleteEvent();
    result.deleted++;
  });
  return result;
}

/** Le partite del file .ics del sito: identificativo, inizio, fine, titolo, luogo e descrizione. */
function parseIcs(text) {
  var lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  var events = [];
  var current = null;
  lines.forEach(function (line) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      return;
    }
    if (line === 'END:VEVENT') {
      if (current && current.uid && current.start) events.push(current);
      current = null;
      return;
    }
    if (!current) return;
    var colon = line.indexOf(':');
    if (colon < 0) return;
    var key = line.slice(0, colon).split(';')[0].toUpperCase();
    var value = line.slice(colon + 1);
    if (key === 'UID') current.uid = value;
    else if (key === 'DTSTART') current.start = parseIcsDate(value);
    else if (key === 'DTEND') current.end = parseIcsDate(value);
    else if (key === 'SUMMARY') current.title = unescapeIcs(value);
    else if (key === 'LOCATION') current.location = unescapeIcs(value);
    else if (key === 'DESCRIPTION') current.description = unescapeIcs(value);
  });
  return events;
}

/** «20261120T180000» è l'ora di Lignano (Europe/Rome); con la Z finale è UTC. */
function parseIcsDate(value) {
  var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!m) return null;
  if (m[7]) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)));
  return Utilities.parseDate(m[1] + '-' + m[2] + '-' + m[3] + ' ' + (m[4] || '00') + ':' + (m[5] || '00'), TIME_ZONE, 'yyyy-MM-dd HH:mm');
}

function unescapeIcs(value) {
  return value.replace(/\\([nN,;\\])/g, function (_, c) {
    return c === 'n' || c === 'N' ? '\n' : c;
  });
}

function normalize(text) {
  return String(text || '').replace(/\r\n/g, '\n').trim();
}

/** L'impronta del calendario senza le righe DTSTAMP (cambiano a ogni lettura): uguale = niente di nuovo. */
function fingerprint(text) {
  var stable = text.replace(/^DTSTAMP:.*$/gm, '');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, stable, Utilities.Charset.UTF_8));
}
