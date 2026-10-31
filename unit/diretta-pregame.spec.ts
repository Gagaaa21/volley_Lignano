import { expect, test } from "@playwright/test";
import { demoScript } from "@/lib/diretta/demo";
import { diffLive, feedReducer, INITIAL_FEED, FULL_EXIT_MS, INTRO_CARD_MS, type Feed } from "@/lib/diretta/overlayEvents";
import { beforeProtocol, hidesScore, pregamePhase, withPregame } from "@/lib/diretta/pregame";
import type { PublicLiveScore } from "@/lib/types";

/**
 * Le fasi prima del fischio d'inizio: copertina finché lo staff non preme «Inizia il riscaldamento», poi il riscaldamento, quello
 * ufficiale da 15 minuti prima, la presentazione da 5 minuti prima, barra e punteggio da 1 minuto prima o dal primo punto.
 */

const START = "2026-10-31T18:00";
const INFO = { date: START, venue: "Palazzetto dello Sport, Lignano Sabbiadoro", home: true, friendly: false };
const at = (time: string) => new Date(`2026-10-31T${time}:00`).getTime();
const MIN = 60_000;

function reading(over: Partial<PublicLiveScore> = {}): PublicLiveScore {
  return {
    team: "u14u15",
    category: "U15",
    home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 0 },
    away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
    serving: null,
    sets: [],
    timeouts: { home: 0, away: 0 },
    finished: false,
    notStarted: true,
    info: INFO,
    updatedAt: "2026-10-31T16:00:00.000Z",
    ...over,
  };
}

const warm = (over: Partial<PublicLiveScore> = {}) => reading({ warmupAt: new Date(at("17:00")).toISOString(), ...over });

test.describe("diretta: le fasi prima della partita", () => {
  test("senza il tasto è copertina, fino a 1 minuto prima del via", () => {
    expect(pregamePhase(reading(), at("16:00"))).toBe("cover");
    expect(pregamePhase(reading(), at("17:50"))).toBe("cover");
    expect(pregamePhase(reading(), at("17:58"))).toBe("cover");
    // Da 1 minuto prima, anche se nessuno ha premuto il tasto: barra e punteggio.
    expect(pregamePhase(reading(), at("17:59"))).toBeNull();
    expect(pregamePhase(reading(), at("18:10"))).toBeNull();
  });

  test("dopo il tasto: riscaldamento, ufficiale da 15 minuti prima, presentazione da 5, punteggio da 1", () => {
    expect(pregamePhase(warm(), at("17:00"))).toBe("warmup");
    expect(pregamePhase(warm(), at("17:44") + 59_000)).toBe("warmup");
    expect(pregamePhase(warm(), at("17:45") + 1)).toBe("officialWarmup");
    expect(pregamePhase(warm(), at("17:54") + 59_000)).toBe("officialWarmup");
    expect(pregamePhase(warm(), at("17:55") + 1)).toBe("protocol");
    expect(pregamePhase(warm(), at("17:58") + 59_000)).toBe("protocol");
    expect(pregamePhase(warm(), at("17:59"))).toBeNull();
    // I confini esatti: a 15 minuti in punto è già ufficiale, a 5 in punto già presentazione.
    expect(pregamePhase(warm(), at("18:00") - 15 * MIN)).toBe("officialWarmup");
    expect(pregamePhase(warm(), at("18:00") - 5 * MIN)).toBe("protocol");
    expect(pregamePhase(warm(), at("18:00") - 1 * MIN)).toBeNull();
  });

  test("a partita cominciata (primo punto) non c'è fase, anche in anticipo sull'orario", () => {
    expect(pregamePhase(warm({ notStarted: undefined }), at("17:30"))).toBeNull();
    expect(pregamePhase(reading({ notStarted: undefined }), at("16:00"))).toBeNull();
  });

  test("senza orario della partita: copertina, poi riscaldamento fino al primo punto", () => {
    expect(pregamePhase(reading({ info: undefined }), at("17:59"))).toBe("cover");
    expect(pregamePhase(warm({ info: undefined }), at("17:59"))).toBe("warmup");
    expect(pregamePhase(warm({ info: { ...INFO, date: "non è una data" } }), at("17:59"))).toBe("warmup");
  });

  test("quando la fase cambia per l'orario, la lettura porta l'ora del cambio (la pagina /diretta ci conta il ritardo)", () => {
    // Salvata alle 17:00 (il tasto): alle 17:50 è riscaldamento ufficiale dalle 17:45, alle 17:57 presentazione dalle 17:55.
    const saved = warm({ updatedAt: new Date(at("17:00")).toISOString() });
    expect(withPregame(saved, at("17:30")).updatedAt).toBe(saved.updatedAt);
    expect(withPregame(saved, at("17:50")).updatedAt).toBe(new Date(at("17:45")).toISOString());
    expect(withPregame(saved, at("17:57")).updatedAt).toBe(new Date(at("17:55")).toISOString());
    expect(withPregame(saved, at("17:59") + 30_000)).toMatchObject({ updatedAt: new Date(at("17:59")).toISOString() });
    // Il tasto premuto tardi (alle 17:50): il cambio è il salvataggio, che resta com'è.
    const late = warm({ warmupAt: new Date(at("17:50")).toISOString(), updatedAt: new Date(at("17:50")).toISOString() });
    expect(withPregame(late, at("17:51"))).toMatchObject({ pregame: "officialWarmup", updatedAt: late.updatedAt });
    // La copertina non cambia ora; a partita cominciata nemmeno.
    expect(withPregame(reading(), at("17:50")).updatedAt).toBe(reading().updatedAt);
    const playing = warm({ notStarted: undefined, updatedAt: new Date(at("17:30")).toISOString() });
    expect(withPregame(playing, at("18:20"))).toBe(playing);
  });

  test("withPregame aggiunge e toglie la fase, senza copiare quando non cambia niente", () => {
    const covered = withPregame(reading(), at("16:00"));
    expect(covered.pregame).toBe("cover");
    expect(withPregame(covered, at("16:30"))).toBe(covered);
    expect(withPregame(covered, at("17:59"))).not.toHaveProperty("pregame");
    const playing = warm({ notStarted: undefined });
    expect(withPregame(playing, at("17:00"))).toBe(playing);
    expect(hidesScore(covered)).toBe(true);
    expect(hidesScore(playing)).toBe(false);
    expect(beforeProtocol({ pregame: "officialWarmup" })).toBe(true);
    expect(beforeProtocol({ pregame: "protocol" })).toBe(false);
  });
});

const T = 1_000_000;
const poll = (feed: Feed, live: PublicLiveScore | null, now: number): Feed => feedReducer(feed, { type: "poll", live, now });
const tick = (feed: Feed, now: number): Feed => feedReducer(feed, { type: "tick", now });
const lineup = { set: 1, positions: [{ number: "7" }, { number: "12" }, { number: "3" }, { number: "9" }, { number: "15" }, { number: "4" }], libero: { number: "1" } };

test.describe("grafica della diretta: copertina e riscaldamento", () => {
  test("la copertina va in onda alla prima lettura e resta finché non si preme il tasto", () => {
    expect(diffLive(null, reading({ pregame: "cover" }))).toMatchObject({ cover: true, intro: false, lineup: null });
    let feed = poll(INITIAL_FEED, reading({ pregame: "cover", lineup }), T);
    expect(feed.full).toMatchObject({ kind: "cover", startedAt: T });
    feed = poll(feed, reading({ pregame: "cover", lineup }), T + 60_000);
    feed = tick(feed, T + 60 * 60_000);
    expect(feed.full?.kind).toBe("cover");
    // Il tasto: la copertina esce (con la sua transizione) e non va in onda niente al suo posto.
    feed = poll(feed, warm({ pregame: "warmup", lineup }), T + 61 * 60_000);
    expect(feed.full).toMatchObject({ kind: "cover", until: T + 61 * 60_000 + FULL_EXIT_MS });
    feed = tick(feed, T + 61 * 60_000 + FULL_EXIT_MS);
    expect(feed).toMatchObject({ full: null, fullQueue: [] });
  });

  test("durante il riscaldamento niente presentazione né formazione; arrivano alla presentazione", () => {
    expect(diffLive(null, warm({ pregame: "warmup", lineup }))).toMatchObject({ cover: false, intro: false, lineup: null });
    let feed = poll(INITIAL_FEED, warm({ pregame: "warmup", lineup }), T);
    feed = poll(feed, warm({ pregame: "officialWarmup", lineup }), T + 1_000);
    expect(feed).toMatchObject({ full: null, fullQueue: [] });
    feed = poll(feed, warm({ pregame: "protocol", lineup }), T + 2_000);
    expect(feed.full).toMatchObject({ kind: "intro", startedAt: T + 2_000, until: T + 2_000 + INTRO_CARD_MS });
    expect(feed.fullQueue.map((card) => card.kind)).toEqual(["lineup"]);
    // Chi apre OBS durante la presentazione la vede lo stesso.
    expect(poll(INITIAL_FEED, warm({ pregame: "protocol", lineup }), T).full?.kind).toBe("intro");
  });

  test("tornare alla copertina dal riscaldamento la rimette in onda; il primo punto la toglie", () => {
    let feed = poll(INITIAL_FEED, warm({ pregame: "warmup" }), T);
    feed = poll(feed, reading({ pregame: "cover" }), T + 1_000);
    expect(feed.full).toMatchObject({ kind: "cover", startedAt: T + 1_000 });
    feed = poll(feed, reading({ notStarted: undefined, home: { name: "Volley Lignano", color: "#1c5bae", score: 1, sets: 0 } }), T + 2_000);
    expect(feed.full).toMatchObject({ kind: "cover", until: T + 2_000 + FULL_EXIT_MS });
    expect(tick(feed, T + 2_000 + FULL_EXIT_MS).full).toBeNull();
  });

  test("la partita finta passa per tutte le fasi, in ordine, prima del via", () => {
    const phases: string[] = [];
    for (const frame of demoScript()) {
      if (!frame) continue;
      const phase = frame.pregame ?? "match";
      if (phases[phases.length - 1] !== phase) phases.push(phase);
    }
    expect(phases).toEqual(["cover", "warmup", "officialWarmup", "protocol", "match"]);
  });
});
