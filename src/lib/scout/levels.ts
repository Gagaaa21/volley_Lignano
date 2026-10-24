import { SCOUT_LEVELS, type ScoutData, type ScoutLevel, type ScoutSettings } from "./types";

/**
 * I due livelli dello scout, da scegliere prima di ogni partita. Il testo sta
 * qui perché lo usano insieme la scelta in pagina, il tabellino, il PDF e il
 * manuale: così non possono dire cose diverse.
 */

export interface ScoutLevelMeta {
  /** Il nome com'è nei menu e nei badge. */
  label: string;
  /** Una riga su chi lo sceglie. */
  tagline: string;
  /** Quanti tocchi servono, a occhio. */
  taps: string;
  /** Che cosa si segna. */
  marks: string[];
  /** Che cosa si ottiene. */
  gets: string[];
  /** Che cosa serve per farlo bene. */
  needs: string[];
}

export const LEVEL_META: Record<ScoutLevel, ScoutLevelMeta> = {
  base: {
    label: "Base",
    tagline: "Come finisce ogni scambio",
    taps: "2-3 tocchi a punto",
    marks: ["Chi ha fatto punto e come: attacco, muro, ace o errore", "La giocatrice che ha compiuto l'azione, se la sai"],
    gets: [
      "Punti, ace, errori e attacchi murati di ogni giocatrice",
      "Break point e cambio palla della squadra",
      "Tabellino, grafico dell'andamento e PDF",
    ],
    needs: ["Un telefono", "Nessuna esperienza"],
  },
  ricezioni: {
    label: "Con ricezioni",
    tagline: "In più, la ricezione di ogni battuta",
    taps: "2 tocchi in più quando riceviamo",
    marks: [
      "Tutto quello del livello Base",
      "Quando riceviamo: chi ha ricevuto e con che voto (# + ! - / =)",
      "La zona della ricezione, se vuoi",
    ],
    gets: [
      "Ricezioni totali, errori, ricezione positiva % e perfetta % di ogni giocatrice",
      "Il cambio palla in base alla qualità della ricezione",
      "La mappa delle zone di ricezione",
    ],
    needs: ["Un telefono", "Un po' di pratica"],
  },
};

/** I livelli nell'ordine in cui si propongono. */
export const LEVEL_ORDER: readonly ScoutLevel[] = SCOUT_LEVELS;

/**
 * Il livello salvato in uno scout: quelli salvati prima dei livelli non lo hanno e valgono «base». Il livello «Completo» (ogni
 * tocco della palla) non c'è più: gli scout segnati così si leggono come «Con ricezioni», con tutti i loro punti.
 */
export function readLevel(level: unknown): ScoutLevel {
  if (level === "completo") return "ricezioni";
  return typeof level === "string" && (SCOUT_LEVELS as readonly string[]).includes(level) ? (level as ScoutLevel) : "base";
}

/** Il livello di uno scout (vedi readLevel). */
export function levelOf(settings: Pick<ScoutSettings, "level"> | { level?: unknown }): ScoutLevel {
  return readLevel(settings.level);
}

/** Si segnano le ricezioni (livello «Con ricezioni»)? */
export function recordsReceptions(level: ScoutLevel): boolean {
  return level !== "base";
}

const LEVEL_RANK: Record<ScoutLevel, number> = { base: 0, ricezioni: 1 };

export function higherLevel(a: ScoutLevel, b: ScoutLevel): ScoutLevel {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;
}

/** Ci sono tocchi segnati (le ricezioni, o i tocchi di uno scout del vecchio livello «Completo»)? */
export function hasTouches(data: Pick<ScoutData, "events">): boolean {
  return data.events.some((event) => event.type === "touch");
}

/**
 * Il livello con cui leggere uno scout: quello scelto, ma se nel corso della partita si sono segnati dei tocchi (si è tornati a
 * «Base» a metà, o è uno scout del vecchio «Completo») vale «Con ricezioni», perché non si nascondano numeri già segnati.
 */
export function effectiveLevel(data: Pick<ScoutData, "settings" | "events">): ScoutLevel {
  return hasTouches(data) ? higherLevel(levelOf(data.settings), "ricezioni") : levelOf(data.settings);
}
