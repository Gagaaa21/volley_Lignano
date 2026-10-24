import {
  otherSide,
  type ScoutGrade,
  type ScoutHow,
  type ScoutSide,
  type ScoutTouch,
  type ScoutTouchSkill,
} from "./types";

/**
 * Le regole dei tocchi: la ricezione del livello «Con ricezioni» e, negli scout
 * del vecchio livello «Completo», ogni tocco della palla (si leggono ancora).
 * Ogni tocco ha un fondamentale e un voto; il voto dice se lo scambio è finito
 * (un ace, un errore, un attacco a terra…) oppure se il gioco continua. Quando finisce, il
 * punto e il «come» si ricavano dal tocco stesso, con le stesse regole dello
 * scout «a punto» (vedi rules.ts): un solo modo di contare, qualunque livello.
 */

export interface GradeMeta {
  /** Il simbolo come lo si legge a schermo («−» vero per il voto negativo). */
  symbol: string;
  /** Nome generico del voto, per le legende. */
  name: string;
}

export const GRADE_META: Record<ScoutGrade, GradeMeta> = {
  "#": { symbol: "#", name: "Perfetta" },
  "+": { symbol: "+", name: "Positiva" },
  "!": { symbol: "!", name: "Neutra" },
  "-": { symbol: "−", name: "Negativa" },
  "/": { symbol: "/", name: "Scarsa" },
  "=": { symbol: "=", name: "Errore" },
};

export interface TouchSkillMeta {
  /** Lettera dei codici Data Volley. */
  letter: string;
  label: string;
  /** I voti che si propongono, dal migliore al peggiore. */
  grades: ScoutGrade[];
  /** Che cosa vuol dire ogni voto per questo fondamentale. */
  gradeLabels: Partial<Record<ScoutGrade, string>>;
  /** Una riga di spiegazione per ogni voto. */
  gradeHints: Partial<Record<ScoutGrade, string>>;
  /** Se ha senso indicare la zona (1-6): come si chiama la scelta. */
  zone: string | null;
}

export const TOUCH_SKILLS: Record<ScoutTouchSkill, TouchSkillMeta> = {
  serve: {
    letter: "S",
    label: "Battuta",
    grades: ["#", "!", "="],
    gradeLabels: { "#": "Ace", "!": "In campo", "=": "Errore" },
    gradeHints: {
      "#": "Palla a terra o non giocabile: punto di chi batte.",
      "!": "La palla è in campo e l'avversaria la riceve.",
      "=": "Fuori, in rete, fallo di piede: punto dell'avversaria.",
    },
    zone: null,
  },
  reception: {
    letter: "R",
    label: "Ricezione",
    grades: ["#", "+", "!", "-", "/", "="],
    gradeLabels: { "#": "Perfetta", "+": "Positiva", "!": "Neutra", "-": "Negativa", "/": "Scarsa", "=": "Errore" },
    gradeHints: {
      "#": "L'alzatrice ha tutte le opzioni a disposizione.",
      "+": "L'alzatrice ha quasi tutte le opzioni.",
      "!": "Palla giocabile, ma l'attacco è limitato.",
      "-": "Alzata obbligata, di solito alta.",
      "/": "Palla rimandata di là o quasi impossibile da alzare.",
      "=": "La palla è toccata e va fuori o a terra: punto dell'avversaria.",
    },
    zone: "Dove è stata ricevuta",
  },
  set: {
    letter: "E",
    label: "Alzata",
    grades: ["#", "+", "!", "-", "="],
    gradeLabels: { "#": "Perfetta", "+": "Buona", "!": "Neutra", "-": "Scarsa", "=": "Errore" },
    gradeHints: {
      "#": "L'attaccante sceglie il colpo senza muro in difficoltà.",
      "+": "Alzata buona, attacco con un buon tempo.",
      "!": "Alzata giocabile, senza vantaggio.",
      "-": "Alzata imprecisa: l'attacco è in difficoltà.",
      "=": "Alzata fuori, in rete o doppia: punto dell'avversaria.",
    },
    zone: null,
  },
  attack: {
    letter: "A",
    label: "Attacco",
    grades: ["#", "+", "/", "="],
    gradeLabels: { "#": "Punto", "+": "Continua", "/": "Murato", "=": "Errore" },
    gradeHints: {
      "#": "Palla a terra nel campo avversario (anche se tocca il muro e va fuori).",
      "+": "La palla viene difesa e il gioco continua.",
      "/": "Fermato dal muro: subito dopo si segna il muro avversario.",
      "=": "Fuori, in rete, antenna: punto dell'avversaria.",
    },
    zone: "Da dove attacca",
  },
  block: {
    letter: "B",
    label: "Muro",
    grades: ["#", "+", "="],
    gradeLabels: { "#": "Punto", "+": "Tocco", "=": "Errore" },
    gradeHints: {
      "#": "La palla cade nel campo di chi attaccava.",
      "+": "Il muro tocca la palla e il gioco continua.",
      "=": "Tocco di rete o invasione a muro: punto dell'avversaria.",
    },
    zone: null,
  },
  dig: {
    letter: "D",
    label: "Difesa",
    grades: ["#", "+", "!", "-", "/", "="],
    gradeLabels: { "#": "Perfetta", "+": "Buona", "!": "Neutra", "-": "Scarsa", "/": "Di là", "=": "Errore" },
    gradeHints: {
      "#": "Palla recuperata benissimo: si può giocare ogni attacco.",
      "+": "Recupero buono, l'alzatrice ha diverse opzioni.",
      "!": "Palla recuperata, ma l'attacco è limitato.",
      "-": "Recupero difficile: alzata obbligata.",
      "/": "La palla torna di là, senza costruire il gioco.",
      "=": "Difesa sbagliata (fuori o a terra dopo il tocco): punto dell'avversaria.",
    },
    zone: "Dove è stata difesa",
  },
};

export function gradeSymbol(grade: ScoutGrade): string {
  return GRADE_META[grade].symbol;
}

/** Il voto positivo di una ricezione o difesa: # e +. */
export function isPositiveGrade(grade: ScoutGrade): boolean {
  return grade === "#" || grade === "+";
}

/** Il voto chiude lo scambio? Un errore sì sempre; un # solo per battuta, attacco e muro (ace, attacco a terra, muro vincente). */
export function endsRally(skill: ScoutTouchSkill, grade: ScoutGrade): boolean {
  if (grade === "=") return true;
  return grade === "#" && (skill === "serve" || skill === "attack" || skill === "block");
}

export interface TouchOutcome {
  actor: ScoutSide;
  how: ScoutHow;
  player: string | null;
  victim: string | null;
}

const ERROR_HOW: Record<ScoutTouchSkill, ScoutHow> = {
  serve: "serveError",
  reception: "receptionError",
  set: "setError",
  attack: "attackError",
  block: "blockError",
  dig: "digError",
};

const POINT_HOW: Partial<Record<ScoutTouchSkill, ScoutHow>> = {
  serve: "ace",
  attack: "attack",
  block: "block",
};

/** Chi attaccava prima di questo muro: l'ultimo attacco della squadra opposta tra i tocchi dello scambio. */
function lastAttacker(before: readonly ScoutTouch[], blockSide: ScoutSide): string | null {
  for (let i = before.length - 1; i >= 0; i--) {
    const t = before[i];
    if (t.skill === "attack" && t.side !== blockSide) return t.player;
  }
  return null;
}

/**
 * L'esito dello scambio se questo tocco lo chiude, altrimenti null. `before`
 * sono i tocchi dello scambio segnati prima di questo.
 */
export function touchOutcome(touch: ScoutTouch, before: readonly ScoutTouch[]): TouchOutcome | null {
  if (!endsRally(touch.skill, touch.grade)) return null;
  const how = touch.grade === "=" ? ERROR_HOW[touch.skill] : POINT_HOW[touch.skill];
  if (!how) return null;
  return {
    actor: touch.side,
    how,
    player: touch.player,
    victim: how === "block" ? lastAttacker(before, touch.side) : null,
  };
}

/** Il tocco che corrisponde a un esito scelto a mano («Punto nostro: attacco»…), se ne ha uno. Falli e sanzioni non sono tocchi. */
function terminalTouchOf(how: ScoutHow, actor: ScoutSide, player: string | null): Omit<ScoutTouch, "id" | "at" | "zone"> | null {
  switch (how) {
    case "ace":
      return { side: actor, skill: "serve", player, grade: "#" };
    case "serveError":
      return { side: actor, skill: "serve", player, grade: "=" };
    case "receptionError":
      return { side: actor, skill: "reception", player, grade: "=" };
    case "attack":
      return { side: actor, skill: "attack", player, grade: "#" };
    case "attackError":
      return { side: actor, skill: "attack", player, grade: "=" };
    case "block":
      return { side: actor, skill: "block", player, grade: "#" };
    case "blockError":
      return { side: actor, skill: "block", player, grade: "=" };
    case "setError":
      return { side: actor, skill: "set", player, grade: "=" };
    case "digError":
      return { side: actor, skill: "dig", player, grade: "=" };
    default:
      return null;
  }
}

export interface RallyForTouches {
  id: string;
  at: number;
  actor: ScoutSide;
  how: ScoutHow;
  player: string | null;
  victim: string | null;
  touches: ScoutTouch[];
  closedBy: "touch" | "outcome";
}

/**
 * Tutti i tocchi dello scambio come servono ai conti: quelli segnati più, se lo
 * scambio è stato chiuso a mano («Punto loro: ace»), il tocco che quell'esito
 * implica. Un muro vincente vuol dire che l'attacco è stato murato: l'ultimo
 * attacco avversario diventa «murato» (o, se non era stato segnato, si aggiunge).
 * Così i totali di chi segna a punto e di chi segna ogni tocco si sommano nello
 * stesso modo.
 */
export function effectiveTouches(rally: RallyForTouches): ScoutTouch[] {
  const list = rally.touches.map((t) => ({ ...t }));
  if (rally.closedBy === "outcome") {
    const own = terminalTouchOf(rally.how, rally.actor, rally.player);
    if (own) list.push({ ...own, id: `${rally.id}:fine`, at: rally.at, zone: null });
  }
  if (rally.how === "block") {
    const blocked = otherSide(rally.actor);
    let index = -1;
    for (let i = list.length - 2; i >= 0; i--) {
      if (list[i].skill === "attack" && list[i].side === blocked) {
        index = i;
        break;
      }
    }
    if (index >= 0) list[index] = { ...list[index], grade: "/" };
    else list.splice(Math.max(list.length - 1, 0), 0, { id: `${rally.id}:murato`, at: rally.at, side: blocked, skill: "attack", player: rally.victim, grade: "/", zone: null });
  }
  return list;
}
