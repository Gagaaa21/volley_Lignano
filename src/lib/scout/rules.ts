import { otherSide, type ScoutHow, type ScoutSide } from "./types";

/** Il fondamentale a cui appartiene l'ultima azione: serve per le colonne del tabellino. */
export type ScoutSkill = "serve" | "reception" | "attack" | "block" | "set" | "dig" | "foul";

/** Punto «sul campo» (palla a terra), errore di un fondamentale, oppure fallo fischiato dall'arbitro. */
export type ScoutHowGroup = "point" | "error" | "foul";

export interface ScoutHowMeta {
  label: string;
  skill: ScoutSkill;
  /** true = è punto di chi compie l'azione; false = è un errore/fallo, il punto va all'altra squadra. */
  scores: boolean;
  group: ScoutHowGroup;
  hint: string;
}

/**
 * Le 16 conclusioni possibili di uno scambio. Seguono le Regole di Gioco
 * FIVB/FIPAV (si segna un punto mettendo la palla a terra nel campo avversario,
 * per un fallo o per una penalizzazione dell'avversaria) e i codici
 * degli scout ufficiali: battuta (S), ricezione (R), attacco (A), muro (B),
 * alzata (E), difesa (D) con esito vincente (#) o errore (=); i falli
 * fischiati — rete, invasione, doppia, trattenuta, quattro tocchi, rotazione —
 * sono i «punti senza fondamentale» dei file Data Volley.
 */
export const HOW_META: Record<ScoutHow, ScoutHowMeta> = {
  attack: {
    label: "Attacco",
    skill: "attack",
    scores: true,
    group: "point",
    hint: "Palla a terra dopo l'attacco (anche se tocca il muro e va fuori)",
  },
  block: {
    label: "Muro",
    skill: "block",
    scores: true,
    group: "point",
    hint: "Muro vincente: la palla cade nel campo di chi attaccava",
  },
  ace: {
    label: "Ace",
    skill: "serve",
    scores: true,
    group: "point",
    hint: "Battuta vincente: palla a terra o non giocabile",
  },
  serveError: {
    label: "Battuta sbagliata",
    skill: "serve",
    scores: false,
    group: "error",
    hint: "Fuori, in rete, fallo di piede",
  },
  receptionError: {
    label: "Ricezione sbagliata",
    skill: "reception",
    scores: false,
    group: "error",
    hint: "Palla toccata in ricezione e mandata fuori o a terra",
  },
  attackError: {
    label: "Attacco sbagliato",
    skill: "attack",
    scores: false,
    group: "error",
    hint: "Fuori, in rete, antenna",
  },
  blockError: {
    label: "Errore a muro",
    skill: "block",
    scores: false,
    group: "error",
    hint: "Tocco di rete o invasione a muro",
  },
  setError: {
    label: "Alzata sbagliata",
    skill: "set",
    scores: false,
    group: "error",
    hint: "Alzata fuori o in rete",
  },
  digError: {
    label: "Difesa sbagliata",
    skill: "dig",
    scores: false,
    group: "error",
    hint: "Difesa mandata fuori o palla a terra",
  },
  netFault: {
    label: "Tocco di rete",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Tocca la rete mentre gioca la palla",
  },
  centerLine: {
    label: "Invasione",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Supera la linea centrale o passa sotto la rete",
  },
  doubleContact: {
    label: "Doppia",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Due tocchi di fila della stessa giocatrice",
  },
  heldBall: {
    label: "Trattenuta",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Palla accompagnata o trattenuta",
  },
  fourHits: {
    label: "Quattro tocchi",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Il quarto tocco della squadra",
  },
  rotationFault: {
    label: "Rotazione / posizione",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Fuori posizione o battuta fuori turno",
  },
  sanction: {
    label: "Sanzione",
    skill: "foul",
    scores: false,
    group: "foul",
    hint: "Penalità (cartellino): il punto va all'avversaria",
  },
};

/** Errori nell'ordine in cui si propongono: prima i fondamentali, poi i falli. */
export const ERROR_HOWS: ScoutHow[] = [
  "serveError",
  "receptionError",
  "attackError",
  "blockError",
  "setError",
  "digError",
  "netFault",
  "centerLine",
  "doubleContact",
  "heldBall",
  "fourHits",
  "rotationFault",
  "sanction",
];

/** I tre modi di fare punto «sul campo», nell'ordine dei pulsanti. */
export const POINT_HOWS: ScoutHow[] = ["attack", "block", "ace"];

export function isPointHow(how: ScoutHow): boolean {
  return HOW_META[how].scores;
}

/** Chi segna il punto: chi compie un'azione vincente, altrimenti l'altra squadra. */
export function rallyWinner(how: ScoutHow, actor: ScoutSide): ScoutSide {
  return HOW_META[how].scores ? actor : otherSide(actor);
}

/** Falli di squadra, non di una singola giocatrice: nei file Data Volley sono i codici «$$» senza giocatrice. */
export const TEAM_FAULT_HOWS: ScoutHow[] = ["rotationFault", "sanction"];

/** Per questi esiti il «chi» non si chiede: la rotazione sbagliata e le sanzioni riguardano la squadra. */
export function asksPlayer(how: ScoutHow): boolean {
  return !TEAM_FAULT_HOWS.includes(how);
}

/**
 * Se a quell'azione di quella squadra si chiede «chi?». Mai per l'attacco vincente dell'avversaria: una loro schiacciata a
 * terra si segna con un tocco solo, senza dire chi (le sue giocatrici si riconoscono a fatica e la partita non aspetta). Per
 * il resto vale `asksPlayer`.
 */
export function asksPlayerFor(actor: ScoutSide, how: ScoutHow): boolean {
  return asksPlayer(how) && !(actor === "opp" && how === "attack");
}

/** Il muro vincente e l'errore a muro. */
export function isBlockHow(how: ScoutHow): boolean {
  return how === "block" || how === "blockError";
}

/** La libero non può murare né tentare di murare (Regole di Gioco): non si propone tra chi può farlo. */
export function canDo(how: ScoutHow, libero: boolean): boolean {
  return !(libero && isBlockHow(how));
}
