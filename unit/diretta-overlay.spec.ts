import { expect, test } from "@playwright/test";
import { checkSource } from "@/components/diretta/VerifyFrame";
import { demoScript } from "@/lib/diretta/demo";
import {
  diffLive,
  FINAL_CARD_MS,
  FULL_EXIT_MS,
  feedReducer,
  INITIAL_FEED,
  INTRO_CARD_MS,
  LINEUP_CARD_MS,
  SET_CARD_MS,
  SET_RECAP_MS,
  SUB_CARD_MS,
  secondsLeft,
  TIMEOUT_CARD_MS,
  type Feed,
} from "@/lib/diretta/overlayEvents";
import { teamShortName } from "@/lib/liveScore";
import type { PublicLineup, PublicLiveScore, PublicSetRecap, PublicSubstitution } from "@/lib/types";

/** La logica della grafica della diretta video: cosa cambia tra due letture e quali grafiche vanno in onda, in che ordine. */

function reading(over: Partial<PublicLiveScore> = {}): PublicLiveScore {
  return {
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", color: "#1c5bae", score: 10, sets: 0 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: 8, sets: 0 },
    serving: "home",
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    updatedAt: "2026-10-18T10:00:00.000Z",
    ...over,
  };
}

const zero = { home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 0 }, away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 } };
const lineupOf = (set: number, first = "7"): PublicLineup => ({
  set,
  positions: [{ number: first }, { number: "12" }, { number: "3" }, { number: "9" }, { number: "15" }, { number: "4" }],
  libero: { number: "1" },
});
const sub = (id: string, inNumber = "10", outNumber = "12"): PublicSubstitution => ({ id, in: { number: inNumber }, out: { number: outNumber }, score: { home: 10, away: 8 } });
const stats = {
  home: { attack: 5, block: 2, ace: 1, gifts: 2, run: 3, timeouts: 0 },
  away: { attack: 4, block: 1, ace: 0, gifts: 3, run: 2, timeouts: 1 },
};

const T = 1_000_000;
const poll = (feed: Feed, live: PublicLiveScore | null, now: number): Feed => feedReducer(feed, { type: "poll", live, now });
const tick = (feed: Feed, now: number): Feed => feedReducer(feed, { type: "tick", now });

test.describe("grafica della diretta: cosa è cambiato", () => {
  test("alla prima lettura di una partita già cominciata, o dopo «niente», non va in onda niente", () => {
    expect(diffLive(null, reading({ timeouts: { home: 1, away: 2 }, subs: [sub("a")] }))).toMatchObject({ timeouts: [], subs: [], intro: false, lineup: null });
    expect(diffLive(reading(), null)).toMatchObject({ timeouts: [], setEnded: null, matchEnded: false });
    const feed = poll(INITIAL_FEED, reading({ timeouts: { home: 1, away: 0 }, subs: [sub("a")] }), T);
    expect(feed).toMatchObject({ full: null, timeout: null, sub: null, fullQueue: [], subQueue: [] });
  });

  test("prima del via: presentazione e poi formazione, anche alla prima lettura (chi apre OBS prima della partita le vede)", () => {
    const pre = reading({ ...zero, serving: null, notStarted: true, lineup: lineupOf(1) });
    expect(diffLive(null, pre)).toMatchObject({ intro: true, lineup: { set: 1 } });
    let feed = poll(INITIAL_FEED, pre, T);
    expect(feed.full).toMatchObject({ kind: "intro", startedAt: T, until: T + INTRO_CARD_MS });
    expect(feed.fullQueue.map((card) => card.kind)).toEqual(["lineup"]);
    // Finita la presentazione va in onda la formazione, con le correzioni fatte nel frattempo.
    feed = poll(feed, { ...pre, lineup: lineupOf(1, "8") }, T + 4_000);
    feed = tick(feed, T + INTRO_CARD_MS);
    expect(feed.full).toMatchObject({ kind: "lineup", until: T + INTRO_CARD_MS + LINEUP_CARD_MS });
    expect(feed.full?.kind === "lineup" && feed.full.lineup.positions[0]?.number).toBe("8");
    // Si accende il live dopo «niente»: di nuovo la presentazione. Senza formazione, solo quella.
    const again = poll(poll(feed, null, T + 40_000), reading({ ...zero, serving: null, notStarted: true }), T + 41_000);
    expect(again.full?.kind).toBe("intro");
    expect(again.fullQueue).toEqual([]);
  });

  test("la presentazione in coda non va più in onda a partita cominciata; la formazione nemmeno, a set iniziato", () => {
    const pre = reading({ ...zero, serving: null, notStarted: true, lineup: lineupOf(1) });
    let feed = poll(INITIAL_FEED, pre, T);
    // Primo punto mentre la presentazione è in onda: esce subito, con la sua transizione, e la formazione in coda non serve più.
    feed = poll(feed, reading({ lineup: lineupOf(1), home: { ...zero.home, score: 1 }, away: zero.away }), T + 3_000);
    expect(feed.full).toMatchObject({ kind: "intro", until: T + 3_000 + FULL_EXIT_MS });
    feed = tick(feed, T + 3_000 + FULL_EXIT_MS);
    expect(feed.full).toBeNull();
    expect(feed.fullQueue).toEqual([]);
  });

  test("un time-out va in onda subito, con i punti del set e il conto alla rovescia", () => {
    expect(diffLive(reading(), reading({ timeouts: { home: 0, away: 1 } })).timeouts).toEqual(["away"]);
    expect(diffLive(reading(), reading({ timeouts: { home: 1, away: 1 } })).timeouts).toEqual(["home", "away"]);
    // Un time-out tolto con «Annulla» non è un time-out.
    expect(diffLive(reading({ timeouts: { home: 1, away: 0 } }), reading()).timeouts).toEqual([]);

    let feed = poll(INITIAL_FEED, reading(), T);
    feed = poll(feed, reading({ timeouts: { home: 1, away: 0 }, setStats: stats }), T + 2_000);
    expect(feed.timeout).toMatchObject({ kind: "timeout", side: "home", stats, startedAt: T + 2_000, until: T + 2_000 + TIMEOUT_CARD_MS });
    expect(secondsLeft(feed.timeout!, T + 2_000)).toBe(30);
    expect(secondsLeft(feed.timeout!, T + 2_000 + 12_300)).toBe(18);
    // Si chiude da sola alla scadenza; una lettura uguale non la riapre; «niente» toglie tutto.
    expect(tick(feed, T + 2_000 + TIMEOUT_CARD_MS - 1).timeout).not.toBeNull();
    expect(tick(feed, T + 2_000 + TIMEOUT_CARD_MS).timeout).toBeNull();
    expect(poll(feed, reading({ timeouts: { home: 1, away: 0 }, setStats: stats }), T + 3_000).timeout).toEqual(feed.timeout);
    expect(poll(feed, null, T + 3_000)).toEqual({ ...INITIAL_FEED, now: T + 3_000 });
  });

  test("i nostri cambi nuovi vanno in onda: un cambio doppio è una grafica sola, quelli già visti no", () => {
    expect(diffLive(reading({ subs: [sub("a")] }), reading({ subs: [sub("a"), sub("b", "8", "3")] })).subs.map((s) => s.id)).toEqual(["b"]);
    let feed = poll(INITIAL_FEED, reading(), T);
    feed = poll(feed, reading({ subs: [sub("a"), sub("b", "8", "3")] }), T + 1_000);
    expect(feed.sub).toMatchObject({ kind: "sub", until: T + 1_000 + SUB_CARD_MS });
    expect(feed.sub?.subs.map((s) => s.id)).toEqual(["a", "b"]);
    // Le stesse letture dopo non ripetono niente; un cambio nuovo mentre l'altro è in onda aspetta il suo turno.
    feed = poll(feed, reading({ subs: [sub("a"), sub("b", "8", "3")] }), T + 3_000);
    expect(feed.subQueue).toEqual([]);
    feed = poll(feed, reading({ subs: [sub("a"), sub("b", "8", "3"), sub("c", "5", "8")] }), T + 4_000);
    expect(feed.subQueue.map((card) => card.kind)).toEqual(["sub"]);
    feed = tick(feed, T + 1_000 + SUB_CARD_MS);
    expect(feed.sub?.subs.map((s) => s.id)).toEqual(["c"]);
  });

  test("un cambio durante il time-out va in onda subito, sopra il time-out, senza aspettare che finisca", () => {
    let feed = poll(INITIAL_FEED, reading(), T);
    feed = poll(feed, reading({ timeouts: { home: 1, away: 0 } }), T + 1_000);
    feed = poll(feed, reading({ timeouts: { home: 1, away: 0 }, subs: [sub("a")] }), T + 5_000);
    expect(feed.timeout).toMatchObject({ kind: "timeout", side: "home" });
    expect(feed.sub).toMatchObject({ kind: "sub", startedAt: T + 5_000 });
  });

  const recapOf = (n: number): PublicSetRecap => ({
    n,
    minutes: 27,
    home: { attack: 12, block: 3, ace: 2, gifts: 8, run: 5, timeouts: 1 },
    away: { attack: 10, block: 1, ace: 1, gifts: 9, run: 4, timeouts: 1 },
  });
  const afterSetOne = (over: Partial<PublicLiveScore> = {}) =>
    reading({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 1 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      sets: [{ home: 25, away: 21 }],
      ...over,
    });
  const beforeSetEnd = reading({
    home: { name: "Volley Lignano", color: "#1c5bae", score: 25, sets: 0 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: 21, sets: 0 },
    timeouts: { home: 2, away: 1 },
    lineup: lineupOf(1),
  });

  test("a fine set il riepilogo a schermo intero: col resoconto dura di più; i time-out che tornano a zero non sono nuovi", () => {
    expect(diffLive(beforeSetEnd, afterSetOne())).toMatchObject({ timeouts: [], setEnded: { n: 1, home: 25, away: 21 }, matchEnded: false });
    const withRecap = poll(poll(INITIAL_FEED, beforeSetEnd, T), afterSetOne({ recap: recapOf(1) }), T + 4_000);
    expect(withRecap.full).toMatchObject({ kind: "set", n: 1, home: 25, away: 21, recap: { n: 1 }, until: T + 4_000 + SET_RECAP_MS });
    expect(SET_RECAP_MS).toBeGreaterThan(SET_CARD_MS);
    // Senza resoconto (il Live score non lo ha), o con quello di un altro set, dura meno e non lo porta.
    for (const after of [afterSetOne(), afterSetOne({ recap: recapOf(2) })]) {
      const feed = poll(poll(INITIAL_FEED, beforeSetEnd, T), after, T + 4_000);
      expect(feed.full).toMatchObject({ kind: "set", until: T + 4_000 + SET_CARD_MS });
      expect(feed.full).not.toHaveProperty("recap");
    }
    // Il resoconto che resta nelle letture dopo non riapre niente.
    const later = poll(withRecap, afterSetOne({ recap: recapOf(1) }), T + 6_000);
    expect(later.full).toEqual(withRecap.full);
    expect(tick(later, T + 4_000 + SET_RECAP_MS).full).toBeNull();
  });

  test("dopo il fine set va in onda la formazione del set nuovo, quando lo staff la conferma a 0–0", () => {
    let feed = poll(poll(INITIAL_FEED, beforeSetEnd, T), afterSetOne({ recap: recapOf(1) }), T + 1_000);
    // La formazione del 2° set arriva mentre il riepilogo è in onda: aspetta.
    feed = poll(feed, afterSetOne({ recap: recapOf(1), lineup: lineupOf(2) }), T + 5_000);
    expect(feed.full?.kind).toBe("set");
    expect(feed.fullQueue.map((card) => card.kind)).toEqual(["lineup"]);
    feed = tick(feed, T + 1_000 + SET_RECAP_MS);
    expect(feed.full).toMatchObject({ kind: "lineup", lineup: { set: 2 } });
    // Una correzione della stessa formazione aggiorna quella in onda, senza ricominciare.
    const until = feed.full!.until;
    feed = poll(feed, afterSetOne({ recap: recapOf(1), lineup: lineupOf(2, "11") }), T + 1_000 + SET_RECAP_MS + 2_000);
    expect(feed.full).toMatchObject({ kind: "lineup", until });
    expect(feed.full?.kind === "lineup" && feed.full.lineup.positions[0]?.number).toBe("11");
    // A set cominciato la formazione non si ripresenta.
    expect(diffLive(afterSetOne({ lineup: lineupOf(2) }), afterSetOne({ lineup: lineupOf(2, "8") })).lineup).toBeNull();
    expect(diffLive(afterSetOne(), afterSetOne({ lineup: lineupOf(2), home: { ...zero.home, sets: 1, score: 1 } })).lineup).toBeNull();
  });

  test("la fine della partita prende il posto di tutto, con i numeri della partita, e un time-out dopo non la copre", () => {
    const playing = reading({ sets: [{ home: 25, away: 21 }], home: { name: "Volley Lignano", color: "#1c5bae", score: 24, sets: 1 }, recap: recapOf(1) });
    const finished = reading({
      sets: [{ home: 25, away: 21 }, { home: 25, away: 22 }],
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 2 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      finished: true,
      recap: recapOf(2),
      matchStats: stats,
    });
    const change = diffLive(playing, finished);
    expect(change.matchEnded).toBe(true);
    expect(change.setEnded).toMatchObject({ n: 2, home: 25, away: 22 });
    let feed = poll(poll(INITIAL_FEED, playing, T), reading({ ...playing, timeouts: { home: 1, away: 0 } }), T + 500);
    expect(feed.timeout?.kind).toBe("timeout");
    feed = poll(feed, finished, T + 1_000);
    expect(feed.full).toMatchObject({ kind: "final", recap: { n: 2 }, stats, until: T + 1_000 + FINAL_CARD_MS });
    expect(feed).toMatchObject({ fullQueue: [], timeout: null, sub: null, subQueue: [] });
    feed = poll(feed, { ...finished, timeouts: { home: 1, away: 0 } }, T + 2_000);
    expect(feed.full?.kind).toBe("final");
  });

  test("un'altra partita, o la prova che ricomincia, non fa scattare animazioni", () => {
    const old = reading({ sets: [{ home: 25, away: 21 }], timeouts: { home: 2, away: 2 }, subs: [sub("a")] });
    const nothing = { timeouts: [], setEnded: null, matchEnded: false, subs: [], lineup: null, intro: false };
    expect(diffLive(old, reading({ away: { name: "Altra squadra", color: "#000000", score: 8, sets: 0 }, subs: [sub("b")] }))).toEqual(nothing);
    // I set tornano indietro: è un'altra partita.
    expect(diffLive(old, reading({ timeouts: { home: 1, away: 0 } }))).toEqual(nothing);
  });
});

test.describe("grafica della diretta: nomi corti e misure della sorgente", () => {
  test("il nome corto toglie forma societaria, «Volley», «Pallavolo» e categoria", () => {
    expect(teamShortName("Volley Lignano")).toBe("Lignano");
    expect(teamShortName("A.S.D. Pallavolo Latisana")).toBe("Latisana");
    expect(teamShortName("Pol. Città Bella")).toBe("Città Bella");
    expect(teamShortName("ASD Volley Club Udine U15")).toBe("Udine");
    expect(teamShortName("Pallavolo San Giorgio di Nogaro")).toBe("San Giorgio");
    expect(teamShortName("Prova Live")).toBe("Prova Live");
    // Se non resta niente, il nome intero.
    expect(teamShortName("Volley")).toBe("Volley");
  });

  test("la verifica riconosce la sorgente giusta, quella piccola (sgranata) e quella con le proporzioni sbagliate", () => {
    expect(checkSource(1920, 1080)).toBe("ok");
    expect(checkSource(3840, 2160)).toBe("ok");
    expect(checkSource(1280, 720)).toBe("small");
    expect(checkSource(800, 600)).toBe("ratio");
    expect(checkSource(1920, 1200)).toBe("ratio");
    expect(checkSource(0, 0)).toBe("ratio");
  });
});

test.describe("grafica della diretta: la partita finta", () => {
  const frames = () => demoScript().filter((frame): frame is PublicLiveScore => frame !== null);

  test("comincia prima del via e racconta due set: battuta, set point, match point, time-out, cambi, serie e finale", () => {
    const script = demoScript();
    expect(script[script.length - 1]).toBeNull();
    const all = frames();
    expect(all[0]).toMatchObject({ notStarted: true, lineup: { set: 1 }, info: { venue: expect.any(String) }, serving: null });
    expect(all.some((f) => f.point?.kind === "set" && f.point.side === "home")).toBe(true);
    expect(all.some((f) => f.point?.kind === "match" && f.point.side === "home")).toBe(true);
    expect(all.some((f) => f.timeouts.home > 0)).toBe(true);
    expect(all.some((f) => f.timeouts.away > 0)).toBe(true);
    expect(all.some((f) => (f.subs?.length ?? 0) >= 2)).toBe(true);
    expect(all.some((f) => (f.run?.points ?? 0) >= 4)).toBe(true);
    expect(all.some((f) => f.lineup?.set === 2)).toBe(true);
    expect(all[all.length - 1]).toMatchObject({ finished: true, home: { sets: 2 }, away: { sets: 0 }, sets: [{ home: 25, away: 20 }, { home: 25, away: 22 }], matchStats: expect.any(Object) });
    // Il 2° set comincia battendo gli altri (la battuta si alterna).
    expect(all.find((f) => f.sets.length === 1)?.serving).toBe("away");
  });

  test("porta il resoconto dell'ultimo set chiuso, con numeri che tornano con il parziale", () => {
    const all = frames();
    expect(all.filter((f) => f.sets.length === 0).every((f) => f.recap === undefined)).toBe(true);
    const total = (t: PublicSetRecap["home"]) => t.attack + t.block + t.ace + t.gifts;
    for (const frame of all.filter((f) => f.sets.length > 0)) {
      const n = frame.sets.length;
      expect(frame.recap?.n).toBe(n);
      expect(total(frame.recap!.home)).toBe(frame.sets[n - 1].home);
      expect(total(frame.recap!.away)).toBe(frame.sets[n - 1].away);
    }
  });

  test("passando per la grafica va in onda tutto, in ordine, e al giro dopo si ripete senza niente di fantasma", () => {
    const aired: string[] = [];
    let feed = INITIAL_FEED;
    // Una grafica che va in onda adesso (non una aggiornata sul posto, che tiene l'ora di partenza).
    const record = (before: Feed, after: Feed, at: number) => {
      if (after.full && after.full !== before.full && after.full.startedAt === at) aired.push(after.full.kind);
      if (after.timeout && after.timeout !== before.timeout && after.timeout.startedAt === at) aired.push(after.timeout.kind);
      if (after.sub && after.sub !== before.sub && after.sub.startedAt === at) aired.push(after.sub.kind);
    };
    let now = T;
    for (const frame of [...demoScript(), ...demoScript()]) {
      // Come la pagina: tra una lettura e l'altra l'ora corre (chiusure e code).
      for (let at = now + 100; at < now + 1_500; at += 100) {
        const before = feed;
        feed = tick(feed, at);
        record(before, feed, at);
      }
      now += 1_500;
      const before = feed;
      feed = poll(feed, frame, now);
      record(before, feed, now);
    }
    const perLap = ["intro", "lineup", "timeout", "sub", "timeout", "set", "lineup", "timeout", "sub", "timeout", "final"];
    expect(aired).toEqual([...perLap, ...perLap]);
  });
});
