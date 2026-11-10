import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { expect, test } from "@playwright/test";
import { matchesToEvents } from "@/lib/calendar";
import { buildICSCalendar } from "@/lib/ics";
import type { Match } from "@/lib/types";

/**
 * Lo script per Google Calendar (scripts/google-calendar/PartiteVolleyLignano.gs) gira nell'account Google del proprietario,
 * non sul sito: qui lo si fa girare in Node con un Google Calendar finto, sul vero .ics che il sito produce (stesso
 * buildICSCalendar di /calendario.ics?solo=partite). Così un cambio al formato del feed che lo rompesse si vede subito.
 */

const SCRIPT = readFileSync(path.join(process.cwd(), "scripts/google-calendar/PartiteVolleyLignano.gs"), "utf8");
const TZ = "Europe/Rome";
const HOUR = 60 * 60 * 1000;

/** «yyyy-MM-dd HH:mm» nell'ora di Roma → istante, come Utilities.parseDate di Apps Script. */
function zonedToUtc(text: string): Date {
  const [, y, mo, d, h, mi] = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(text)!.map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let guess = target;
  const format = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  for (let i = 0; i < 2; i++) {
    const parts = format.formatToParts(new Date(guess));
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    guess -= Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - target;
  }
  return new Date(guess);
}

class FakeEvent {
  tags = new Map<string, string>();
  deleted = false;
  constructor(
    private owner: FakeCalendar,
    public title: string,
    public start: Date,
    public end: Date,
    public location: string,
    public description: string,
  ) {}
  getTag(key: string) { return this.tags.get(key) ?? null; }
  setTag(key: string, value: string) { this.tags.set(key, value); }
  getTitle() { return this.title; }
  setTitle(value: string) { this.owner.writes++; this.title = value; }
  getStartTime() { return this.start; }
  getEndTime() { return this.end; }
  setTime(start: Date, end: Date) { this.owner.writes++; this.start = start; this.end = end; }
  getLocation() { return this.location; }
  setLocation(value: string) { this.owner.writes++; this.location = value; }
  getDescription() { return this.description; }
  setDescription(value: string) { this.owner.writes++; this.description = value; }
  deleteEvent() { this.owner.writes++; this.deleted = true; this.owner.events = this.owner.events.filter((e) => e !== this); }
}

class FakeCalendar {
  events: FakeEvent[] = [];
  writes = 0;
  reads = 0;
  constructor(public id: string, public name: string, public options: Record<string, unknown>) {}
  getId() { return this.id; }
  getEvents(from: Date, to: Date) { this.reads++; return this.events.filter((e) => e.end > from && e.start < to); }
  createEvent(title: string, start: Date, end: Date, options: { location?: string; description?: string }) {
    this.writes++;
    const event = new FakeEvent(this, title, start, end, options.location ?? "", options.description ?? "");
    this.events.push(event);
    return event;
  }
}

/** Un account Google finto con lo script caricato: calendari, proprietà, trigger e la risposta del sito. */
function googleAccount() {
  const calendars: FakeCalendar[] = [];
  const props = new Map<string, string>();
  const triggers: { handler: string; minutes: number }[] = [];
  const site = { code: 200, body: "" };
  const fetched: string[] = [];
  const warnings: string[] = [];
  const context = vm.createContext({
    console: { log() {}, warn: (message: string) => warnings.push(message) },
    UrlFetchApp: {
      fetch(url: string) {
        fetched.push(url);
        return { getResponseCode: () => site.code, getContentText: () => site.body };
      },
    },
    Utilities: {
      parseDate: (text: string, tz: string) => {
        expect(tz).toBe(TZ);
        return zonedToUtc(text);
      },
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      computeDigest: (_: string, text: string) => [...createHash("sha256").update(text, "utf8").digest()],
      base64Encode: (bytes: number[]) => Buffer.from(bytes).toString("base64"),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => props.get(key) ?? null,
        setProperty: (key: string, value: string) => void props.set(key, value),
        deleteProperty: (key: string) => void props.delete(key),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ScriptApp: {
      newTrigger: (handler: string) => ({
        timeBased: () => ({ everyMinutes: (minutes: number) => ({ create: () => triggers.push({ handler, minutes }) }) }),
      }),
      getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.handler, ref: t })),
      deleteTrigger: (trigger: { ref: { handler: string; minutes: number } }) => void triggers.splice(triggers.indexOf(trigger.ref), 1),
    },
    CalendarApp: {
      getCalendarById: (id: string) => calendars.find((c) => c.id === id) ?? null,
      getOwnedCalendarsByName: (name: string) => calendars.filter((c) => c.name === name),
      createCalendar: (name: string, options: Record<string, unknown>) => {
        const calendar = new FakeCalendar(`cal-${calendars.length + 1}`, name, options);
        calendars.push(calendar);
        return calendar;
      },
    },
  });
  vm.runInContext(SCRIPT, context);
  const run = (name: "attiva" | "disattiva" | "sincronizza") => (context[name] as () => void)();
  return { calendars, props, triggers, site, fetched, warnings, run };
}

function match(overrides: Partial<Match>): Match {
  return {
    id: "m1",
    team: "u14u15",
    category: "U14",
    opponent: "Degano",
    isHome: true,
    location: "Palestra Comunale",
    matchDate: "2026-12-12T18:00",
    isFriendly: false,
    isTournament: false,
    meetingTime: null,
    meetingLocation: null,
    notes: null,
    calledUpAthleteIds: [],
    setScores: null,
    resultSetsWon: null,
    resultSetsLost: null,
    tournamentGames: null,
    createdBy: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

/** Il prossimo «mm-gg» a partire da oggi, come data della partita alle 18:00. */
function next(monthDay: string): string {
  const now = new Date();
  let year = now.getFullYear();
  if (new Date(`${year}-${monthDay}T18:00:00`) <= now) year += 1;
  return `${year}-${monthDay}T18:00`;
}

const feed = (matches: Match[]) => buildICSCalendar(matchesToEvents(matches), "Volley Lignano · Partite");

test.describe("script per Google Calendar: partite sempre aggiornate nel calendario personale", () => {
  const winter = next("01-15");
  const summer = next("06-15");
  const base = [
    match({ id: "w1", category: "U14", opponent: "Degano", matchDate: winter, location: "Palestra, via Roma; 3" }),
    match({ id: "s1", category: "U15", opponent: "Pol. Esempio con un nome davvero molto lungo per spezzare le righe del file", matchDate: summer, isHome: false }),
    match({ id: "t1", category: "U15", opponent: "Triangolare con Latisana", isTournament: true, matchDate: winter }),
  ];

  test("«attiva»: un aggiornamento ogni 5 minuti e un calendario suo con tutte le partite, all'ora giusta di Lignano", () => {
    const google = googleAccount();
    google.site.body = feed(base);
    google.run("attiva");
    expect(google.triggers).toEqual([{ handler: "sincronizza", minutes: 5 }]);
    expect(google.fetched[0]).toBe("https://volley-lignano.vercel.app/calendario.ics?solo=partite");
    expect(google.calendars).toHaveLength(1);
    const calendar = google.calendars[0];
    expect(calendar.name).toBe("Partite Volley Lignano");
    expect(calendar.options.timeZone).toBe(TZ);

    const byTitle = new Map(calendar.events.map((e) => [e.title, e]));
    const w = byTitle.get("U14 · vs Degano")!;
    // 18:00 a Roma: d'inverno è UTC+1, d'estate UTC+2. La partita dura due ore.
    expect(w.start.toISOString()).toBe(`${winter.slice(0, 10)}T17:00:00.000Z`);
    expect(w.end.getTime() - w.start.getTime()).toBe(2 * HOUR);
    expect(w.location).toBe("Palestra, via Roma; 3");
    expect(w.getTag("volleyLignanoUid")).toBe("w1@volley-lignano");
    // Un titolo lungo (nel file è spezzato su più righe) torna intero.
    const s = byTitle.get("U15 · vs Pol. Esempio con un nome davvero molto lungo per spezzare le righe del file")!;
    expect(s.start.toISOString()).toBe(`${summer.slice(0, 10)}T16:00:00.000Z`);
    expect(calendar.events).toHaveLength(3);

    // Riattivarlo non raddoppia né il trigger né il calendario.
    google.run("attiva");
    expect(google.triggers).toHaveLength(1);
    expect(google.calendars).toHaveLength(1);
    expect(calendar.events).toHaveLength(3);
  });

  test("una partita spostata, cambiata, giocata, nuova o cancellata: il calendario la segue, il resto non si tocca", () => {
    const google = googleAccount();
    google.site.body = feed(base);
    google.run("attiva");
    const calendar = google.calendars[0];
    const before = new Map(calendar.events.map((e) => [e.getTag("volleyLignanoUid"), e]));

    const moved = winter.replace("T18:00", "T20:30");
    google.site.body = feed([
      match({ ...base[0], matchDate: moved, location: "Palazzetto nuovo", setScores: [{ us: 25, them: 20 }, { us: 25, them: 18 }, { us: 25, them: 22 }], resultSetsWon: 3, resultSetsLost: 0 }),
      base[1],
      match({ id: "n1", category: "U14", opponent: "Nuova", matchDate: summer }),
    ]);
    calendar.writes = 0;
    google.run("sincronizza");

    const after = new Map(calendar.events.map((e) => [e.getTag("volleyLignanoUid"), e]));
    expect([...after.keys()].sort()).toEqual(["n1@volley-lignano", "s1@volley-lignano", "w1@volley-lignano"]);
    const w = after.get("w1@volley-lignano")!;
    expect(w).toBe(before.get("w1@volley-lignano")); // stesso evento aggiornato, non uno nuovo
    expect(w.start.toISOString()).toBe(`${winter.slice(0, 10)}T19:30:00.000Z`);
    expect(w.location).toBe("Palazzetto nuovo");
    expect(w.description).toBe("Risultato: vinta 3–0 (25-20, 25-18, 25-22)");
    expect(before.get("t1@volley-lignano")!.deleted).toBe(true);
    // Scritture: ora, luogo e descrizione della partita cambiata, una nuova, una tolta. Quella uguale non si tocca.
    expect(calendar.writes).toBe(5);
  });

  test("se non cambia niente non si tocca il calendario (le righe DTSTAMP cambiano a ogni lettura); ogni 6 ore si ricontrolla", () => {
    const google = googleAccount();
    google.site.body = feed(base);
    google.run("attiva");
    const calendar = google.calendars[0];
    calendar.reads = 0;
    calendar.writes = 0;
    google.site.body = feed(base).replace(/DTSTAMP:\d{8}T\d{6}Z/g, "DTSTAMP:20991231T235959Z");
    google.run("sincronizza");
    expect(calendar.reads).toBe(0);
    expect(calendar.writes).toBe(0);

    // Un evento rovinato a mano torna a posto al controllo completo.
    calendar.events[0].title = "toccato a mano";
    google.props.set("lastFullCheck", String(Date.now() - 7 * HOUR));
    google.run("sincronizza");
    expect(calendar.reads).toBe(1);
    expect(calendar.events.map((e) => e.title)).not.toContain("toccato a mano");
  });

  test("sito irraggiungibile, risposta strana o nessuna partita: non si cancella niente", () => {
    const google = googleAccount();
    google.site.body = feed(base);
    google.run("attiva");
    const calendar = google.calendars[0];
    calendar.writes = 0;
    for (const [code, body] of [[500, "errore"], [200, "<html>pagina</html>"], [200, feed([])]] as const) {
      google.site.code = code;
      google.site.body = body;
      google.run("sincronizza");
    }
    expect(calendar.writes).toBe(0);
    expect(calendar.events).toHaveLength(3);
    expect(google.warnings.length).toBe(3);
  });

  test("gli altri eventi del calendario non si toccano; un doppione delle nostre si toglie; un calendario cancellato si rifà", () => {
    const google = googleAccount();
    google.site.body = feed(base);
    google.run("attiva");
    const calendar = google.calendars[0];
    const mine = calendar.createEvent("Mio impegno", new Date(), new Date(Date.now() + HOUR), {});
    const copy = calendar.createEvent("copia", new Date(winter), new Date(new Date(winter).getTime() + HOUR), {});
    copy.setTag("volleyLignanoUid", "w1@volley-lignano");
    google.props.delete("lastHash");
    google.run("sincronizza");
    expect(calendar.events).toContain(mine);
    expect(calendar.events.filter((e) => e.getTag("volleyLignanoUid") === "w1@volley-lignano")).toHaveLength(1);

    // Il calendario cancellato a mano: al giro dopo se ne crea uno nuovo con tutte le partite.
    google.calendars.splice(0, 1);
    google.props.delete("lastHash");
    google.run("sincronizza");
    expect(google.calendars).toHaveLength(1);
    expect(google.calendars[0].events).toHaveLength(3);
  });

  test("«disattiva» spegne l'aggiornamento", () => {
    const google = googleAccount();
    google.site.body = feed(base);
    google.run("attiva");
    google.run("disattiva");
    expect(google.triggers).toEqual([]);
  });
});
