import { DEFAULT_OPPONENT_COLOR, HOME_TEAM_LABEL, teamColor } from "@/lib/liveScore";
import type { PublicLineup, PublicLiveScore, PublicPlayer, PublicSetRecap, PublicSetRecapTeam, PublicSubstitution } from "@/lib/types";
import { setPointHolder, setsToWin } from "@/lib/volleyRules";
import { FINAL_CARD_MS, INTRO_CARD_MS, LINEUP_CARD_MS, RUN_MIN, SET_RECAP_MS, type Side } from "./overlayEvents";

/**
 * Una partita finta per provare la grafica in OBS senza uno Scout acceso (`/diretta/grafica?prova=1`): le fasi prima del via
 * (copertina, riscaldamento, riscaldamento ufficiale, presentazione e formazione: qui in pochi secondi l'una, nella partita vera
 * le decide l'orario, vedi pregame.ts), poi tre set: il 1° vinto da Lignano, il 2° perso ai vantaggi, il 3° (tie-break a 15) vinto
 * con il cambio di campo a 8. Dentro: battuta, time-out (il punteggio resta fermo finché dura, come in palestra), un cambio e un
 * cambio doppio, i numeri del set a 8 e 16, una serie di punti, set point, match point, «Ai vantaggi», fine set con i numeri e il
 * risultato finale. La pagina la ripete in ciclo; ogni elemento è una «lettura» del punteggio pubblico, come quelle vere. Nomi e
 * numeri sono inventati.
 */

/** Ogni quanto avanza la partita finta. */
export const DEMO_STEP_MS = 1_500;

type DemoEvent = "timeout-home" | "timeout-away" | "sub" | "double-sub";
/** Un passo: punteggio del set e, se c'è, cosa succede a quel punto (il punteggio non cambia). */
type Step = readonly [home: number, away: number, event?: DemoEvent];

const SET_ONE: Step[] = [
  [0, 0], [1, 0], [1, 1], [3, 2], [6, 4], [8, 7], [10, 10], [10, 10, "timeout-away"], [12, 11], [13, 11], [14, 11], [15, 11],
  [16, 11], [16, 12], [16, 12, "sub"], [18, 13], [18, 13, "timeout-home"], [20, 15], [22, 17], [24, 19], [24, 20], [25, 20],
];

const SET_TWO: Step[] = [
  [0, 0], [1, 0], [3, 1], [6, 4], [9, 8], [12, 12], [12, 12, "timeout-away"], [14, 16], [17, 19], [17, 19, "double-sub"],
  [17, 19, "timeout-home"], [20, 21], [22, 22], [23, 23], [24, 23], [24, 24], [24, 25], [24, 26],
];

/** Il tie-break, a 15: a 8 di chi è avanti si cambia campo. */
const SET_THREE: Step[] = [
  [0, 0], [1, 0], [2, 2], [4, 3], [6, 4], [7, 5], [8, 5], [9, 7], [10, 9], [10, 9, "timeout-away"], [12, 10], [13, 11], [14, 11],
  [14, 12], [15, 12],
];

/** I numeri di squadra dei tre set (attacco + muri + ace + errori avversari fanno il punteggio: 25–20, 24–26 e 15–12). */
const DEMO_RECAPS: PublicSetRecap[] = [
  {
    n: 1,
    minutes: 27,
    home: { attack: 12, block: 3, ace: 2, gifts: 8, run: 5, timeouts: 1 },
    away: { attack: 10, block: 1, ace: 1, gifts: 8, run: 3, timeouts: 1 },
  },
  {
    n: 2,
    minutes: 29,
    home: { attack: 12, block: 3, ace: 1, gifts: 8, run: 3, timeouts: 1 },
    away: { attack: 13, block: 2, ace: 2, gifts: 9, run: 4, timeouts: 1 },
  },
  {
    n: 3,
    minutes: 16,
    home: { attack: 8, block: 2, ace: 1, gifts: 4, run: 3, timeouts: 0 },
    away: { attack: 6, block: 1, ace: 1, gifts: 4, run: 2, timeouts: 1 },
  },
];

const player = (number: string, name: string): PublicPlayer => ({ number, name });
const LINEUPS: PublicLineup[] = [
  {
    set: 1,
    positions: [player("7", "Rossi"), player("12", "Bianchi"), player("3", "Verdi"), player("9", "Neri"), player("15", "Galli"), player("4", "Conti")],
    libero: player("1", "Riva"),
  },
  {
    set: 2,
    positions: [player("4", "Conti"), player("7", "Rossi"), player("10", "Costa"), player("3", "Verdi"), player("9", "Neri"), player("15", "Galli")],
    libero: player("1", "Riva"),
  },
  {
    set: 3,
    positions: [player("12", "Bianchi"), player("3", "Verdi"), player("9", "Neri"), player("15", "Galli"), player("4", "Conti"), player("7", "Rossi")],
    libero: player("1", "Riva"),
  },
];
const SUBS: Record<"sub" | "double-sub", { in: PublicPlayer; out: PublicPlayer }[]> = {
  sub: [{ in: player("10", "Costa"), out: player("12", "Bianchi") }],
  "double-sub": [
    { in: player("8", "Ferri"), out: player("3", "Verdi") },
    { in: player("12", "Bianchi"), out: player("10", "Costa") },
  ],
};

/** Letture ferme prima del via: presentazione e formazione, una dopo l'altra. */
const PRE_HOLD = Math.ceil((INTRO_CARD_MS + LINEUP_CARD_MS) / DEMO_STEP_MS) + 2;
/** Letture per ognuna delle fasi prima della presentazione: copertina, riscaldamento, riscaldamento ufficiale. */
const PHASE_HOLD = 4;
/** Letture ferme a 0–0 a inizio 2° set: il resoconto del 1° set, poi la formazione del 2°. Come una partita vera, dove tra un set e l'altro passano minuti. */
const BREAK_HOLD = Math.ceil((SET_RECAP_MS + LINEUP_CARD_MS) / DEMO_STEP_MS) + 1;
/** Letture ferme durante un time-out: il punteggio non cambia finché si sta in panchina (poi il primo punto chiude la grafica). */
const TIMEOUT_HOLD = 8;
/** Letture ferme sul finale, poi «niente» (la grafica sparisce) prima di ricominciare. */
const FINAL_HOLD = Math.ceil(FINAL_CARD_MS / DEMO_STEP_MS) + 2;

const DEMO_OPPONENT = "Pol. Esempio";
const DEMO_UPDATED_AT = "2026-10-18T10:00:00.000Z";
const DEMO_INFO = { date: "2026-10-31T18:00", venue: "Palazzetto dello Sport, Lignano Sabbiadoro", home: true, friendly: false };
const DEMO_SET_TARGET = 25;
const DEMO_TIEBREAK_TARGET = 15;

/** Numeri di squadra verosimili per un punteggio parziale: circa metà attacchi, poi muri, ace e regali. */
function roughCounts(points: number, timeouts: number, run: number): PublicSetRecapTeam {
  const attack = Math.round(points * 0.5);
  const block = Math.round(points * 0.12);
  const ace = Math.round(points * 0.08);
  return { attack, block, ace, gifts: Math.max(0, points - attack - block - ace), run, timeouts };
}

function addCounts(a: PublicSetRecapTeam, b: PublicSetRecapTeam): PublicSetRecapTeam {
  return {
    attack: a.attack + b.attack,
    block: a.block + b.block,
    ace: a.ace + b.ace,
    gifts: a.gifts + b.gifts,
    run: Math.max(a.run, b.run),
    timeouts: a.timeouts + b.timeouts,
  };
}

export function demoScript(): (PublicLiveScore | null)[] {
  const frames: (PublicLiveScore | null)[] = [];
  const done: { home: number; away: number }[] = [];
  const wins = { home: 0, away: 0 };
  const needed = setsToWin("bo3") ?? 2;
  const colors = { home: teamColor("A", "match", DEFAULT_OPPONENT_COLOR), away: "#e11d48" };
  const teams = (home: number, away: number) => ({
    home: { name: HOME_TEAM_LABEL, color: colors.home, score: home, sets: wins.home },
    away: { name: DEMO_OPPONENT, color: colors.away, score: away, sets: wins.away },
  });

  const base = (): Pick<PublicLiveScore, "team" | "category" | "sets" | "recap" | "info" | "updatedAt"> => ({
    team: "u14u15",
    category: "U15",
    sets: done.map((set) => ({ ...set })),
    // Come nel punteggio vero: il resoconto è quello dell'ultimo set chiuso, e resta finché non se ne chiude un altro.
    ...(done.length > 0 ? { recap: DEMO_RECAPS[done.length - 1] } : {}),
    info: DEMO_INFO,
    updatedAt: DEMO_UPDATED_AT,
  });

  // Prima del via: live acceso, 0–0. La copertina, il riscaldamento e quello ufficiale, poi presentazione e formazione.
  const pre: PublicLiveScore = {
    ...base(),
    ...teams(0, 0),
    serving: null,
    timeouts: { home: 0, away: 0 },
    finished: false,
    lineup: LINEUPS[0],
    notStarted: true,
  };
  for (const pregame of ["cover", "warmup", "officialWarmup"] as const) {
    for (let i = 0; i < PHASE_HOLD; i++) frames.push({ ...pre, pregame });
  }
  for (let i = 0; i < PRE_HOLD; i++) frames.push({ ...pre, pregame: "protocol" });

  /** `hold`: letture ferme sul primo punteggio del set (vedi BREAK_HOLD). `target`: a quanti punti finisce; `deciding`: è il tie-break. */
  const playSet = (steps: Step[], index: number, firstServer: Side, hold = 0, target = DEMO_SET_TARGET, deciding = false) => {
    const used = { home: 0, away: 0 };
    const subs: PublicSubstitution[] = [];
    let serving: Side = firstServer;
    let previous: Step = [0, 0];
    let run = null as { side: Side; points: number } | null;
    let longest = { home: 0, away: 0 };
    for (const [stepIndex, step] of steps.entries()) {
      const [home, away, event] = step;
      if (event === "timeout-home") used.home += 1;
      else if (event === "timeout-away") used.away += 1;
      else if (event === "sub" || event === "double-sub") {
        for (const [i, change] of SUBS[event].entries()) subs.push({ id: `demo-${index}-${stepIndex}-${i}`, ...change, score: { home, away } });
      } else if (home !== previous[0] || away !== previous[1]) {
        const homeGain = home - previous[0];
        const awayGain = away - previous[1];
        serving = homeGain >= awayGain ? "home" : "away";
        // La serie: punti di una sola squadra la allungano, punti di tutte e due la azzerano (non si sa in che ordine).
        if (homeGain > 0 && awayGain > 0) run = null;
        else {
          const side: Side = homeGain > 0 ? "home" : "away";
          run = run?.side === side ? { side, points: run.points + homeGain + awayGain } : { side, points: homeGain + awayGain };
          longest = { ...longest, [side]: Math.max(longest[side], run.points) };
        }
      }
      const holder = setPointHolder(home, away, target);
      const side: Side | null = holder === "a" ? "home" : holder === "b" ? "away" : null;
      const point: PublicLiveScore["point"] = side ? { side, kind: wins[side] + 1 >= needed ? "match" : "set" } : null;
      const playing = home + away > 0;
      const setStats = playing ? { home: roughCounts(home, used.home, longest.home), away: roughCounts(away, used.away, longest.away) } : null;
      const closed = DEMO_RECAPS.slice(0, done.length);
      const matchStats = closed.reduce(
        (total, recap) => ({ home: addCounts(total.home, recap.home), away: addCounts(total.away, recap.away) }),
        setStats ?? { home: roughCounts(0, 0, 0), away: roughCounts(0, 0, 0) },
      );
      const current: PublicLiveScore = {
        ...base(),
        ...teams(home, away),
        // A 0–0 del 1° set nessuno batte ancora; dal 2° set si sa già chi comincia.
        serving: playing || done.length > 0 ? serving : null,
        timeouts: { ...used },
        finished: false,
        ...(point ? { point } : {}),
        setRules: { target, deciding },
        ...(setStats ? { setStats } : {}),
        ...(playing || done.length > 0 ? { matchStats } : {}),
        ...(run && run.points >= RUN_MIN ? { run: { ...run } } : {}),
        ...(subs.length > 0 ? { subs: subs.map((sub) => ({ ...sub })) } : {}),
        lineup: LINEUPS[index],
      };
      frames.push(current);
      if (stepIndex === 0) for (let i = 0; i < hold; i++) frames.push(current);
      if (event === "timeout-home" || event === "timeout-away") for (let i = 0; i < TIMEOUT_HOLD; i++) frames.push(current);
      previous = step;
    }
    const [home, away] = steps[steps.length - 1];
    done.push({ home, away });
    wins[home > away ? "home" : "away"] += 1;
  };

  playSet(SET_ONE, 0, "home");
  playSet(SET_TWO, 1, "away", BREAK_HOLD);
  playSet(SET_THREE, 2, "home", BREAK_HOLD, DEMO_TIEBREAK_TARGET, true);

  // Partita finita: il punteggio del set è azzerato e contano i set vinti (come nel banner del sito).
  const totals = DEMO_RECAPS.reduce((total, recap) => ({ home: addCounts(total.home, recap.home), away: addCounts(total.away, recap.away) }), {
    home: roughCounts(0, 0, 0),
    away: roughCounts(0, 0, 0),
  });
  const final: PublicLiveScore = {
    ...base(),
    ...teams(0, 0),
    serving: null,
    timeouts: { home: 0, away: 0 },
    finished: true,
    matchStats: totals,
  };
  for (let i = 0; i < FINAL_HOLD; i++) frames.push(final);
  frames.push(null);
  return frames;
}
