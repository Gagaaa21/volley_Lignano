import {
  otherSide,
  type ScoutGrade,
  type ScoutHow,
  type ScoutSide,
  type ScoutTouch,
  type ScoutTouchSkill,
} from "./types";

/**
 * Le regole dei tocchi (livelli «Con ricezioni» e «Completo»). Ogni tocco ha un
 * fondamentale e un voto; il voto dice se lo scambio è finito (un ace, un
 * errore, un attacco a terra…) oppure se il gioco continua. Quando finisce, il
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

/** L'ordine in cui si propongono i fondamentali (le lettere sono quelle di Data Volley: B è il muro, «block»). */
export const TOUCH_SKILL_ORDER: ScoutTouchSkill[] = ["serve", "reception", "set", "attack", "block", "dig"];

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

/** Il voto sta tra quelli che si propongono per quel fondamentale? */
export function isGradeAllowed(skill: ScoutTouchSkill, grade: ScoutGrade): boolean {
  return TOUCH_SKILLS[skill].grades.includes(grade);
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

export interface NextTouch {
  skill: ScoutTouchSkill;
  side: ScoutSide;
}

/**
 * Il tocco più probabile dopo quelli già segnati: serve solo a preselezionare
 * i pulsanti, chi segna può sempre scegliere altro. Senza tocchi in sospeso
 * comincia lo scambio con la battuta di chi ha la battuta.
 */
export function suggestNext(pending: readonly ScoutTouch[], server: ScoutSide, tracksSets = false): NextTouch {
  const last = pending[pending.length - 1];
  if (!last) return { skill: "serve", side: server };
  // Palla rimandata di là: l'altra squadra la gioca e attacca.
  if ((last.skill === "reception" || last.skill === "dig" || last.skill === "set") && last.grade === "/") {
    return { skill: "attack", side: otherSide(last.side) };
  }
  switch (last.skill) {
    case "serve":
      return { skill: "reception", side: otherSide(last.side) };
    case "reception":
    case "dig":
      // L'alzata si segna solo se si è abituati a segnarla: altrimenti dopo la ricezione o la difesa si passa all'attacco.
      return tracksSets ? { skill: "set", side: last.side } : { skill: "attack", side: last.side };
    case "set":
      return { skill: "attack", side: last.side };
    case "attack":
      return last.grade === "/"
        ? { skill: "block", side: otherSide(last.side) }
        : { skill: "dig", side: otherSide(last.side) };
    case "block":
      // Il muro ha toccato la palla e il gioco continua: di solito resta a chi ha murato.
      return { skill: "dig", side: last.side };
  }
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

/** Il tocco che di solito segue questo (a gioco in corso, con un tocco positivo). */
function typicalAfter(current: NextTouch, tracksSets: boolean): NextTouch {
  const { skill, side } = current;
  switch (skill) {
    case "serve":
      return { skill: "reception", side: otherSide(side) };
    case "reception":
    case "dig":
      return tracksSets ? { skill: "set", side } : { skill: "attack", side };
    case "set":
      return { skill: "attack", side };
    case "attack":
      return { skill: "dig", side: otherSide(side) };
    case "block":
      return { skill: "dig", side };
  }
}

/** Le fasi che di solito seguono `from`, per far vedere come si alternano le due squadre (battuta, ricezione, alzata, attacco, difesa…). */
export function flowAfter(from: NextTouch, tracksSets: boolean, count = 3): NextTouch[] {
  const flow: NextTouch[] = [];
  let current = from;
  for (let i = 0; i < count; i++) {
    current = typicalAfter(current, tracksSets);
    flow.push(current);
  }
  return flow;
}

const TEAM_NAME: Record<ScoutSide, string> = { us: "la nostra squadra", opp: "l'avversaria" };

export interface PhaseHint {
  /** Il tocco che tocca adesso (lo stesso di suggestNext). */
  next: NextTouch;
  /** Perché tocca a questo tocco, in una frase. */
  why: string;
  /** Le fasi che di solito seguono. */
  after: NextTouch[];
}

/**
 * Cosa succede adesso nello scambio e perché, con le fasi che di solito
 * seguono: serve a chi segna per capire a che punto è la palla e di chi è il
 * turno, senza dover ricordare la sequenza (battuta, ricezione, alzata, attacco,
 * muro e difesa, poi di nuovo dall'altra parte).
 */
export function describeNext(pending: readonly ScoutTouch[], server: ScoutSide, tracksSets = false): PhaseHint {
  const next = suggestNext(pending, server, tracksSets);
  const last = pending[pending.length - 1];
  const after = flowAfter(next, tracksSets);
  const team = TEAM_NAME[next.side];
  const lastTeam = last ? TEAM_NAME[last.side] : team;
  let why: string;
  if (!last) {
    why = `Ogni scambio comincia dalla battuta: batte ${TEAM_NAME[server]}.`;
  } else if ((last.skill === "reception" || last.skill === "dig" || last.skill === "set") && last.grade === "/") {
    why = `${cap(lastTeam)} ha rimandato la palla di là: ora la gioca e attacca ${team}.`;
  } else {
    switch (last.skill) {
      case "serve":
        why = `La battuta è in campo: la riceve ${team}.`;
        break;
      case "reception":
        why = `Dopo la ricezione ${team} costruisce il gioco: ${tracksSets ? "alzata e " : ""}attacco.`;
        break;
      case "dig":
        why = `Dopo la difesa ${team} ricostruisce: ${tracksSets ? "alzata e " : ""}attacco.`;
        break;
      case "set":
        why = `Dopo l'alzata ${team} attacca.`;
        break;
      case "attack":
        why =
          last.grade === "/"
            ? `L'attacco è stato fermato dal muro: segna il muro di ${team} (a punto o solo tocco).`
            : `L'attacco è stato difeso e il gioco continua: ora difende ${team}.`;
        break;
      case "block":
        why = `Il muro ha toccato la palla e il gioco continua: ora difende ${team}, che ha murato.`;
        break;
    }
  }
  return { next, why, after };
}

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
