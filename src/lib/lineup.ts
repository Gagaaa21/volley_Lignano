import { frontPositions, hasLiberoOption, rotateOnce } from "@/lib/courtLayout";
import type { CourtPosition } from "@/lib/types";

/**
 * Formazione in campo di una squadra: chi sta in ogni posizione, la libero e
 * le due giocatrici che sostituisce. È il motore di rotazione e libero usato
 * da Live score e da Scout, così le due sezioni seguono esattamente le stesse
 * regole. Un «nome» è la stringa che identifica chi gioca: un nome o un numero
 * di maglia nel Live score, l'id della giocatrice nello Scout.
 *
 * Regole (Regole di Gioco, regola 15 e 19):
 * - si ruota, in senso orario, solo quando una squadra CONQUISTA la battuta
 *   (vince lo scambio mentre ricevevano); chi la tiene non ruota;
 * - la libero sostituisce chi sta in seconda linea, senza limiti di cambi, e
 *   non batte mai: quindi la centrale in posizione 1 batte lei stessa, e la
 *   libero entra al suo posto solo quando la squadra torna a ricevere;
 * - la libero non gioca mai in prima linea: quando chi sostituisce ruota a
 *   rete, rientra lei di persona.
 */

export interface CourtLineup {
  /** Un nome per posizione: positions[0] = posizione 1 (la battuta). */
  positions: string[];
  liberoName: string;
  /** Le due giocatrici che la libero sostituisce quando sono in seconda linea. */
  hostNames: [string, string];
  /** Chi la libero sta sostituendo in questo momento (null se nessuna). Si ricalcola a ogni scambio. */
  liberoActiveFor: string | null;
}

function clean(name: string | null | undefined): string {
  return (name ?? "").trim();
}

/** La libero conta solo se il formato la prevede, è in uso e ha un nome. */
export function liberoUsable(lineup: Pick<CourtLineup, "liberoName">, players: number, useLibero: boolean): boolean {
  return useLibero && hasLiberoOption(players as 2 | 3 | 4 | 5 | 6) && clean(lineup.liberoName) !== "";
}

/**
 * Chi la libero sostituisce adesso: la prima delle due sostituite che sta in
 * seconda linea. In posizione 1 resta lei a battere se la squadra sta
 * servendo (la libero non batte); se invece la squadra riceve, la libero la
 * rimpiazza anche lì.
 */
export function liberoTarget(lineup: CourtLineup, players: number, isServing: boolean): string | null {
  const front = frontPositions(players as 2 | 3 | 4 | 5 | 6);
  for (const host of lineup.hostNames) {
    const name = clean(host);
    if (!name) continue;
    const index = lineup.positions.findIndex((n) => clean(n) === name);
    if (index < 0) continue;
    const position = (index + 1) as CourtPosition;
    if (front.includes(position)) continue;
    if (position === 1 && isServing) continue;
    return name;
  }
  return null;
}

/** Aggiorna chi la libero sostituisce, in base a dove stanno le giocatrici e a chi sta battendo. */
export function refreshLibero<T extends CourtLineup>(
  lineup: T,
  players: number,
  useLibero: boolean,
  isServing: boolean,
): T {
  const target = liberoUsable(lineup, players, useLibero) ? liberoTarget(lineup, players, isServing) : null;
  return target === lineup.liberoActiveFor ? lineup : { ...lineup, liberoActiveFor: target };
}

/** Una rotazione in senso orario: chi era in posizione 2 batte, chi era in 1 va nell'ultima. */
export function rotateLineup<T extends CourtLineup>(lineup: T): T {
  return { ...lineup, positions: rotateOnce(lineup.positions) };
}

/**
 * `steps` rotazioni in senso orario, o indietro se negativo (una correzione a mano: la libero non si riallinea qui, vedi
 * refreshLibero). Con 0, o un giro intero, la formazione resta la stessa.
 */
export function rotateLineupBy<T extends CourtLineup>(lineup: T, steps: number): T {
  const size = lineup.positions.length;
  if (size === 0) return lineup;
  const turns = ((Math.trunc(steps) % size) + size) % size;
  let positions = lineup.positions;
  for (let i = 0; i < turns; i++) positions = rotateOnce(positions);
  return turns === 0 ? lineup : { ...lineup, positions };
}

/**
 * Una squadra dopo uno scambio: chi vince conquista la battuta (e ruota) oppure
 * la tiene (e non ruota); chi perde, se batteva, passa a ricevere. In entrambi i
 * casi la libero si riallinea a dove stanno ora le giocatrici.
 */
export function lineupAfterRally<T extends CourtLineup>(
  lineup: T,
  options: {
    players: number;
    useLibero: boolean;
    /** Questa squadra ha vinto lo scambio. */
    won: boolean;
    /** Questa squadra batteva all'inizio dello scambio. */
    wasServing: boolean;
  },
): T {
  const { players, useLibero, won, wasServing } = options;
  if (!won) return refreshLibero(lineup, players, useLibero, false);
  return refreshLibero(wasServing ? lineup : rotateLineup(lineup), players, useLibero, true);
}

/** Dopo uno scambio, per entrambe le squadre (vedi lineupAfterRally). */
export function afterRally<T extends CourtLineup>(options: {
  players: number;
  useLibero: boolean;
  winner: T;
  loser: T;
  /** Chi ha vinto lo scambio batteva già: nessuna rotazione. */
  winnerWasServing: boolean;
}): { winner: T; loser: T } {
  const { players, useLibero, winnerWasServing } = options;
  return {
    winner: lineupAfterRally(options.winner, { players, useLibero, won: true, wasServing: winnerWasServing }),
    loser: lineupAfterRally(options.loser, { players, useLibero, won: false, wasServing: !winnerWasServing }),
  };
}

/**
 * Chi sta giocando in una posizione, con la libero al posto di chi sostituisce. La libero è una sola: se per un
 * errore lo stesso nome è scritto in due posizioni (vedi lineupIssues) compare solo nella prima, la stessa che
 * liberoTarget ha scelto, e non in tutte quelle che hanno quel nome.
 */
export function courtOccupant(
  lineup: CourtLineup,
  position: CourtPosition,
  showLibero: boolean,
): { name: string; isLibero: boolean } {
  const atPosition = clean(lineup.positions[position - 1]);
  if (showLibero && lineup.liberoActiveFor && atPosition === lineup.liberoActiveFor) {
    const first = lineup.positions.findIndex((n) => clean(n) === lineup.liberoActiveFor);
    if (first === position - 1) return { name: clean(lineup.liberoName), isLibero: true };
  }
  return { name: atPosition, isLibero: false };
}

/** Chi batterà se la squadra conquista la battuta (la giocatrice in posizione 2). */
export function nextServer(lineup: CourtLineup): string {
  return clean(lineup.positions[1]);
}

/** Chi batte ora (la giocatrice in posizione 1: la libero non batte mai). */
export function currentServerName(lineup: CourtLineup): string {
  return clean(lineup.positions[0]);
}

/** Perché una sostituzione non si può fare, o null se va bene. */
export function substitutionProblemFor(
  lineup: CourtLineup,
  position: CourtPosition,
  incoming: string,
  liberoActive: boolean,
): string | null {
  const name = clean(incoming);
  const outgoing = clean(lineup.positions[position - 1]);
  if (!name) return "Indica chi entra.";
  if (name === outgoing) return "È già in campo in quella posizione.";
  if (lineup.positions.some((n) => clean(n) === name)) return `${name} è già in campo.`;
  if (liberoActive && clean(lineup.liberoName) === name) {
    return "La libero entra ed esce da sola: non serve un cambio.";
  }
  return null;
}

/**
 * Sostituzione: chi entra prende la posizione di chi esce. Se chi esce era una
 * delle sostituite dalla libero, il ruolo passa a chi entra (e se la libero era
 * in campo per lei, ci resta). Conta come cambio solo se in quella posizione
 * c'era davvero qualcuna.
 */
export function substituteLineup<T extends CourtLineup>(
  lineup: T,
  position: CourtPosition,
  incoming: string,
  context: { players: number; useLibero: boolean; isServing: boolean },
): { lineup: T; outgoing: string; counts: boolean } {
  const name = clean(incoming);
  const outgoing = clean(lineup.positions[position - 1]);
  const positions = [...lineup.positions];
  positions[position - 1] = name;
  const hostNames = lineup.hostNames.map((h) => (outgoing && clean(h) === outgoing ? name : h)) as [string, string];
  const next = refreshLibero(
    { ...lineup, positions, hostNames },
    context.players,
    context.useLibero,
    context.isServing,
  );
  return { lineup: next, outgoing, counts: outgoing !== "" };
}

/** Un cambio già fatto in questo set, per controllare quelli che seguono. */
export interface SubstitutionRecord {
  /** La posizione di campo in cui è avvenuto: serve solo a raccontarlo (la rotazione la sposta, il rientro non dipende da lei). */
  position: number;
  out: string;
  in: string;
}

/**
 * Chi può rientrare: una titolare uscita in questo set, una volta sola, che non è ancora rientrata. Restituisce chi
 * l'ha sostituita, cioè chi deve uscire per lei: rientra al posto della sostituta, in qualunque posizione di campo
 * si trovi adesso (la rotazione sposta la sostituta, e con lei il posto della titolare). Null in tutti gli altri casi
 * (non è uscita, è una riserva, è già rientrata).
 */
export function reentryFor(options: {
  player: string;
  subs: SubstitutionRecord[];
  /** Chi era in campo all'inizio del set. */
  starters: string[];
}): { replacedBy: string } | null {
  const name = clean(options.player);
  if (!name || !options.starters.some((n) => clean(n) === name)) return null;
  const exits = options.subs.filter((s) => s.out === name);
  if (exits.length !== 1) return null;
  if (options.subs.some((s) => s.in === name)) return null;
  return { replacedBy: exits[0].in };
}

/**
 * Avvertimento (non un divieto: un infortunio o un'espulsione fanno eccezione)
 * quando un cambio non rispetta le regole delle sostituzioni nel 6 contro 6
 * (regola 15.6): al massimo 8 per set (6 fino al 2025/26: vedi
 * SUBSTITUTIONS_PER_SET in volleyRules.ts); una titolare può uscire una sola volta e
 * rientrare una sola volta, ma solo al posto di chi l'ha sostituita (qualunque sia
 * la posizione di campo in cui la sostituta si trova adesso: nel frattempo la
 * squadra può aver ruotato); una riserva entra una volta sola per set e può
 * essere sostituita solo dalla titolare per cui è entrata. Null se va tutto bene.
 */
export function substitutionRuleWarning(options: {
  /** Chi entra e chi esce (identificativi). */
  incoming: string;
  outgoing: string;
  /** I cambi già fatti da questa squadra in questo set. */
  subs: SubstitutionRecord[];
  /** Chi era in campo all'inizio del set. */
  starters: string[];
  /** Cambi consentiti per set (8), null se non ci sono limiti da controllare. */
  limit: number | null;
  /** Come si scrive una giocatrice nei messaggi. */
  label?: (id: string) => string;
}): string | null {
  const name = clean(options.incoming);
  const outgoing = clean(options.outgoing);
  const { subs, limit } = options;
  const label = options.label ?? ((id: string) => id);
  if (!name || !outgoing) return null;
  if (limit !== null && subs.length >= limit) {
    return `Sono già stati fatti ${limit} cambi in questo set: un altro non è previsto dal regolamento.`;
  }
  const exits = (player: string) => subs.filter((s) => s.out === player);
  const entries = (player: string) => subs.filter((s) => s.in === player);
  const wasStarter = (player: string) => options.starters.some((n) => clean(n) === player);

  // Chi entra: già uscita in questo set?
  const left = exits(name)[0];
  if (left) {
    if (!wasStarter(name)) return `${label(name)} è già uscita in questo set: una riserva non può rientrare.`;
    if (entries(name).length > 0) return `${label(name)} è già rientrata in questo set: può farlo una volta sola.`;
    if (outgoing !== left.in) {
      return `${label(name)} può rientrare solo al posto di chi l'ha sostituita (${label(left.in)}), in qualunque posizione si trovi adesso.`;
    }
  }
  // Chi esce: una titolare già uscita e rientrata non può uscire di nuovo.
  if (exits(outgoing).length > 0 && entries(outgoing).length > 0 && wasStarter(outgoing)) {
    return `${label(outgoing)} è già uscita e rientrata in questo set: non può uscire un'altra volta.`;
  }
  // Chi esce è una riserva entrata per una titolare: può uscire solo per lei (qualunque sia la sua posizione ora).
  const replaced = subs.find((s) => s.in === outgoing && !wasStarter(outgoing));
  if (replaced && name !== replaced.out) {
    return `${label(outgoing)} è entrata per ${label(replaced.out)}: può essere sostituita solo da lei.`;
  }
  return null;
}

/** Un errore nella formazione scritta a mano: la stessa giocatrice in due posti. */
export interface LineupIssue {
  /**
   * - duplicate: lo stesso numero (o nome) è scritto in più posizioni;
   * - liberoOnCourt: la libero ha lo stesso numero di una giocatrice in campo;
   * - sameHost: le due giocatrici sostituite dalla libero sono la stessa.
   */
  kind: "duplicate" | "liberoOnCourt" | "sameHost";
  /** Il numero o il nome in questione, come è scritto. */
  value: string;
  /** Le posizioni di campo coinvolte (da 1), da segnare in rosso. */
  positions: CourtPosition[];
}

/** Come si confrontano due nomi scritti a mano: senza spazi attorno e senza badare alle maiuscole. */
function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

/**
 * Cosa non torna in una formazione: nessuna giocatrice può stare in due posizioni, la libero non è anche in campo e
 * le due sostituite dalla libero sono due giocatrici diverse. Con un nome ripetuto la rotazione e la libero non
 * hanno più un senso (la libero comparirebbe in due posti insieme), quindi la partita non parte finché non si corregge.
 * Le posizioni vuote non contano.
 */
export function lineupIssues(lineup: CourtLineup, options: { players: number; useLibero: boolean }): LineupIssue[] {
  const issues: LineupIssue[] = [];
  const groups: { value: string; positions: CourtPosition[] }[] = [];
  lineup.positions.forEach((raw, index) => {
    const name = clean(raw);
    if (!name) return;
    const group = groups.find((g) => sameName(g.value, name));
    if (group) group.positions.push((index + 1) as CourtPosition);
    else groups.push({ value: name, positions: [(index + 1) as CourtPosition] });
  });
  for (const group of groups) {
    if (group.positions.length > 1) issues.push({ kind: "duplicate", ...group });
  }
  const libero = clean(lineup.liberoName);
  if (libero && options.useLibero && hasLiberoOption(options.players as 2 | 3 | 4 | 5 | 6)) {
    const onCourt = groups.find((g) => sameName(g.value, libero));
    if (onCourt) issues.push({ kind: "liberoOnCourt", value: libero, positions: onCourt.positions });
    const [first, second] = lineup.hostNames;
    if (clean(first) && sameName(first, second)) {
      issues.push({ kind: "sameHost", value: clean(first), positions: groups.find((g) => sameName(g.value, first))?.positions ?? [] });
    }
  }
  return issues;
}

/** «1», «1 e 5», «1, 3 e 5». */
function listPositions(positions: number[]): string {
  if (positions.length <= 1) return positions.join("");
  return `${positions.slice(0, -1).join(", ")} e ${positions[positions.length - 1]}`;
}

/** L'errore scritto in italiano, per chi sta preparando la formazione (con «numero» in Partita, con il nome in Allenamento). */
export function lineupIssueText(issue: LineupIssue, options: { numeric: boolean; players: number }): string {
  const who = options.numeric ? `Il numero ${issue.value}` : `«${issue.value}»`;
  const where = listPositions(issue.positions);
  switch (issue.kind) {
    case "duplicate":
      return `${who} compare nelle posizioni ${where}: ogni giocatrice sta in una posizione sola.`;
    case "liberoOnCourt":
      return options.numeric
        ? `Il numero ${issue.value} è quello della libero ed è anche in campo (posizione ${where}): ogni numero va usato una volta sola.`
        : `«${issue.value}» è la libero ed è anche in campo (posizione ${where}): servono due giocatrici diverse.`;
    case "sameHost": {
      const player = options.numeric ? `n. ${issue.value}` : issue.value;
      return options.players === 6
        ? `Le due centrali sono la stessa giocatrice (${player}): scegline due diverse.`
        : `Le due giocatrici sostituite dalla libero sono la stessa (${player}): scegline due diverse.`;
    }
  }
}

/**
 * Numeri o nomi già presi nella formazione, per non offrirli due volte: quelli delle altre posizioni e, se c'è la
 * libero, anche il suo. `slot` è la posizione che si sta scegliendo oppure «libero»: il suo valore attuale non conta.
 */
export function namesTakenElsewhere(
  lineup: CourtLineup,
  slot: CourtPosition | "libero",
  options: { players: number; useLibero: boolean },
): string[] {
  const taken = lineup.positions.flatMap((name, index) => (slot === index + 1 ? [] : [clean(name)]));
  if (slot !== "libero" && options.useLibero && hasLiberoOption(options.players as 2 | 3 | 4 | 5 | 6)) {
    taken.push(clean(lineup.liberoName));
  }
  return taken.filter(Boolean);
}
