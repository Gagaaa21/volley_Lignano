import { expect, test } from "@playwright/test";
import { demoScript } from "@/lib/diretta/demo";
import {
  diffLive,
  FINAL_CARD_MS,
  feedReducer,
  INITIAL_FEED,
  SET_CARD_MS,
  secondsLeft,
  TIMEOUT_CARD_MS,
  type Feed,
} from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore } from "@/lib/types";

/** La logica della grafica della diretta video: cosa cambia tra due letture e quale scheda si apre. */

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

const T = 1_000_000;
const poll = (feed: Feed, live: PublicLiveScore | null, now: number): Feed => feedReducer(feed, { type: "poll", live, now });

test.describe("grafica della diretta: cosa è cambiato", () => {
  test("alla prima lettura, o dopo «niente», non si annuncia niente", () => {
    expect(diffLive(null, reading({ timeouts: { home: 1, away: 2 } }))).toEqual({ timeouts: [], setEnded: null, matchEnded: false });
    expect(diffLive(reading(), null)).toEqual({ timeouts: [], setEnded: null, matchEnded: false });
    const feed = poll(INITIAL_FEED, reading({ timeouts: { home: 1, away: 0 } }), T);
    expect(feed.card).toBeNull();
  });

  test("un time-out in più apre la scheda della squadra che lo ha chiamato", () => {
    expect(diffLive(reading(), reading({ timeouts: { home: 0, away: 1 } })).timeouts).toEqual(["away"]);
    expect(diffLive(reading(), reading({ timeouts: { home: 1, away: 1 } })).timeouts).toEqual(["home", "away"]);
    // Un time-out tolto con «Annulla» non è un time-out.
    expect(diffLive(reading({ timeouts: { home: 1, away: 0 } }), reading()).timeouts).toEqual([]);

    let feed = poll(INITIAL_FEED, reading(), T);
    feed = poll(feed, reading({ timeouts: { home: 1, away: 0 } }), T + 2_000);
    expect(feed.card).toMatchObject({ kind: "timeout", side: "home", startedAt: T + 2_000, until: T + 2_000 + TIMEOUT_CARD_MS });
    expect(secondsLeft(feed.card!, T + 2_000)).toBe(30);
    expect(secondsLeft(feed.card!, T + 2_000 + 12_300)).toBe(18);
  });

  test("la scheda si chiude da sola alla scadenza e con «niente» sparisce subito", () => {
    let feed = poll(INITIAL_FEED, reading(), T);
    feed = poll(feed, reading({ timeouts: { home: 0, away: 1 } }), T + 1_000);
    expect(feedReducer(feed, { type: "tick", now: T + 1_000 + TIMEOUT_CARD_MS - 1 }).card).not.toBeNull();
    expect(feedReducer(feed, { type: "tick", now: T + 1_000 + TIMEOUT_CARD_MS }).card).toBeNull();
    // Una lettura uguale non riapre né chiude la scheda.
    expect(poll(feed, reading({ timeouts: { home: 0, away: 1 } }), T + 3_000).card).toEqual(feed.card);
    expect(poll(feed, null, T + 3_000)).toEqual({ live: null, card: null, now: T + 3_000 });
  });

  test("un set chiuso apre «Fine set» e i time-out che tornano a zero non sono time-out nuovi", () => {
    const before = reading({ home: { name: "Volley Lignano", color: "#1c5bae", score: 25, sets: 0 }, away: { name: "Pol. Esempio", color: "#e11d48", score: 21, sets: 0 }, timeouts: { home: 2, away: 1 } });
    const after = reading({
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 1 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      sets: [{ home: 25, away: 21 }],
      timeouts: { home: 0, away: 0 },
    });
    expect(diffLive(before, after)).toEqual({ timeouts: [], setEnded: { n: 1, home: 25, away: 21 }, matchEnded: false });
    const feed = poll(poll(INITIAL_FEED, before, T), after, T + 4_000);
    expect(feed.card).toMatchObject({ kind: "set", n: 1, home: 25, away: 21, until: T + 4_000 + SET_CARD_MS });
  });

  test("la fine della partita batte tutto, e un time-out dopo non la copre", () => {
    const playing = reading({ sets: [{ home: 25, away: 21 }], home: { name: "Volley Lignano", color: "#1c5bae", score: 24, sets: 1 } });
    const finished = reading({
      sets: [{ home: 25, away: 21 }, { home: 25, away: 22 }],
      home: { name: "Volley Lignano", color: "#1c5bae", score: 0, sets: 2 },
      away: { name: "Pol. Esempio", color: "#e11d48", score: 0, sets: 0 },
      finished: true,
    });
    const change = diffLive(playing, finished);
    expect(change.matchEnded).toBe(true);
    expect(change.setEnded).toMatchObject({ n: 2, home: 25, away: 22 });
    let feed = poll(poll(INITIAL_FEED, playing, T), finished, T + 1_000);
    expect(feed.card).toMatchObject({ kind: "final", until: T + 1_000 + FINAL_CARD_MS });
    feed = poll(feed, { ...finished, timeouts: { home: 1, away: 0 } }, T + 2_000);
    expect(feed.card?.kind).toBe("final");
  });

  test("un'altra partita, o la prova che ricomincia, non fa scattare animazioni", () => {
    const old = reading({ sets: [{ home: 25, away: 21 }], timeouts: { home: 2, away: 2 } });
    expect(diffLive(old, reading({ away: { name: "Altra squadra", color: "#000000", score: 8, sets: 0 } }))).toEqual({ timeouts: [], setEnded: null, matchEnded: false });
    // I set tornano indietro: è un'altra partita.
    expect(diffLive(old, reading({ timeouts: { home: 1, away: 0 } }))).toEqual({ timeouts: [], setEnded: null, matchEnded: false });
  });
});

test.describe("grafica della diretta: la partita finta", () => {
  test("racconta due set, con set point, match point, time-out di tutte e due e il finale, e finisce con «niente»", () => {
    const script = demoScript();
    expect(script[script.length - 1]).toBeNull();
    const frames = script.filter((frame): frame is PublicLiveScore => frame !== null);
    expect(frames[0]).toMatchObject({ home: { score: 0, sets: 0 }, away: { score: 0, sets: 0 }, serving: "home", finished: false });
    expect(frames.some((f) => f.point?.kind === "set" && f.point.side === "home")).toBe(true);
    expect(frames.some((f) => f.point?.kind === "match" && f.point.side === "home")).toBe(true);
    expect(frames.some((f) => f.timeouts.home > 0)).toBe(true);
    expect(frames.some((f) => f.timeouts.away > 0)).toBe(true);
    expect(frames[frames.length - 1]).toMatchObject({ finished: true, home: { sets: 2 }, away: { sets: 0 }, sets: [{ home: 25, away: 21 }, { home: 25, away: 22 }] });
    // Il 2° set comincia battendo gli altri (la battuta si alterna).
    expect(frames.find((f) => f.sets.length === 1)?.serving).toBe("away");
  });

  test("passando per la grafica, si aprono le schede giuste e al giro dopo non scatta niente di fantasma", () => {
    const kinds: string[] = [];
    let feed = INITIAL_FEED;
    let now = T;
    for (const frame of [...demoScript(), ...demoScript()]) {
      const before = feed.card;
      feed = poll(feed, frame, now);
      if (feed.card && feed.card !== before) kinds.push(feed.card.kind);
      now += 1_500;
    }
    // Per giro: time-out (x4), fine 1° set, finale. La seconda volta si ripete uguale, senza inventare altro.
    const perLap = ["timeout", "timeout", "set", "timeout", "timeout", "final"];
    expect(kinds).toEqual([...perLap, ...perLap]);
  });
});
