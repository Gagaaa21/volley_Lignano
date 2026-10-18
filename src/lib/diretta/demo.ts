import { DEFAULT_OPPONENT_COLOR, HOME_TEAM_LABEL, teamColor } from "@/lib/liveScore";
import type { PublicLiveScore } from "@/lib/types";
import { setPointHolder, setsToWin } from "@/lib/volleyRules";
import type { Side } from "./overlayEvents";

/**
 * Una partita finta per provare la grafica in OBS senza uno Scout acceso (`/diretta/grafica?prova=1`): due set vinti da
 * Lignano, con punti, battuta, due time-out per set, set point, match point, fine set e finale. La pagina la ripete in
 * ciclo; ogni elemento è una «lettura» del punteggio pubblico, come quelle vere.
 */

/** Un passo: punteggio del set e, se c'è, chi chiama time-out a quel punto (il punteggio non cambia). */
type Step = readonly [home: number, away: number, timeout?: Side];

const SET_ONE: Step[] = [
  [0, 0], [1, 0], [1, 1], [3, 2], [6, 4], [8, 7], [10, 10], [10, 10, "away"], [12, 11], [15, 13], [16, 15], [16, 15, "home"],
  [19, 17], [21, 18], [23, 19], [24, 20], [24, 21], [25, 21],
];

const SET_TWO: Step[] = [
  [0, 0], [1, 0], [3, 1], [6, 4], [9, 8], [12, 12], [12, 12, "away"], [14, 16], [17, 19], [17, 19, "home"], [20, 21],
  [22, 22], [23, 22], [24, 22], [25, 22],
];

const DEMO_OPPONENT = "Pol. Esempio";
const DEMO_UPDATED_AT = "2026-10-18T10:00:00.000Z";
const DEMO_SET_TARGET = 25;

export function demoScript(): (PublicLiveScore | null)[] {
  const frames: (PublicLiveScore | null)[] = [];
  const done: { home: number; away: number }[] = [];
  const wins = { home: 0, away: 0 };
  const needed = setsToWin("bo3") ?? 2;
  const colors = { home: teamColor("A", "match", DEFAULT_OPPONENT_COLOR), away: "#e11d48" };

  const frame = (overrides: Pick<PublicLiveScore, "home" | "away" | "serving" | "timeouts" | "finished" | "point">): PublicLiveScore => ({
    team: "u14u15",
    category: "U15",
    sets: done.map((set) => ({ ...set })),
    updatedAt: DEMO_UPDATED_AT,
    ...overrides,
  });

  const playSet = (steps: Step[], firstServer: Side) => {
    const used = { home: 0, away: 0 };
    let serving: Side = firstServer;
    let previous: Step = [0, 0];
    for (const step of steps) {
      const [home, away, timeout] = step;
      if (timeout) used[timeout] += 1;
      else if (home !== previous[0] || away !== previous[1]) serving = home - previous[0] >= away - previous[1] ? "home" : "away";
      const holder = setPointHolder(home, away, DEMO_SET_TARGET);
      const side: Side | null = holder === "a" ? "home" : holder === "b" ? "away" : null;
      const point: PublicLiveScore["point"] = side ? { side, kind: wins[side] + 1 >= needed ? "match" : "set" } : null;
      frames.push(
        frame({
          home: { name: HOME_TEAM_LABEL, color: colors.home, score: home, sets: wins.home },
          away: { name: DEMO_OPPONENT, color: colors.away, score: away, sets: wins.away },
          serving,
          timeouts: { ...used },
          finished: false,
          ...(point ? { point } : {}),
        }),
      );
      previous = step;
    }
    const [home, away] = steps[steps.length - 1];
    done.push({ home, away });
    wins[home > away ? "home" : "away"] += 1;
  };

  playSet(SET_ONE, "home");
  playSet(SET_TWO, "away");

  // Partita finita: il punteggio del set è azzerato e contano i set vinti (come nel banner del sito).
  const final = frame({
    home: { name: HOME_TEAM_LABEL, color: colors.home, score: 0, sets: wins.home },
    away: { name: DEMO_OPPONENT, color: colors.away, score: 0, sets: wins.away },
    serving: null,
    timeouts: { home: 0, away: 0 },
    finished: true,
  });
  // Qualche lettura ferma sul finale, poi «niente» (la grafica sparisce) prima di ricominciare.
  frames.push(final, final, final, final, null);
  return frames;
}
