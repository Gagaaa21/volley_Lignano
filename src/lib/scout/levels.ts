import { SCOUT_LEVELS, type ScoutData, type ScoutLevel, type ScoutSettings } from "./types";

/**
 * I tre livelli dello scout, da scegliere prima di ogni partita. Il testo sta
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
  completo: {
    label: "Completo",
    tagline: "Ogni tocco della palla, come in Serie A1",
    taps: "5-10 tocchi a scambio",
    marks: [
      "Ogni tocco: battuta, ricezione, alzata, attacco, muro, difesa",
      "Chi lo ha fatto e con che voto",
      "La zona di ricezione, difesa e attacco, se vuoi",
    ],
    gets: [
      "Attacchi totali, punto % ed efficienza; battute, muri e difese per giocatrice",
      "Break point e cambio palla per rotazione",
      "Le mappe di ricezione, difesa e attacco",
      "Il tabellino a colonne come quello di Lega",
    ],
    needs: ["Una persona dedicata, meglio con un tablet", "Allenamento: qualche partita di pratica"],
  },
};

/** I livelli nell'ordine in cui si propongono. */
export const LEVEL_ORDER: readonly ScoutLevel[] = SCOUT_LEVELS;

/** Il livello di uno scout: quelli salvati prima dei livelli non lo hanno e valgono «base». */
export function levelOf(settings: Pick<ScoutSettings, "level"> | { level?: unknown }): ScoutLevel {
  const level = settings.level;
  return typeof level === "string" && (SCOUT_LEVELS as readonly string[]).includes(level) ? (level as ScoutLevel) : "base";
}

/** Si segnano le ricezioni (livelli «Con ricezioni» e «Completo»)? */
export function recordsReceptions(level: ScoutLevel): boolean {
  return level !== "base";
}

/** Si segnano tutti i tocchi (livello «Completo»)? */
export function recordsTouches(level: ScoutLevel): boolean {
  return level === "completo";
}

const LEVEL_RANK: Record<ScoutLevel, number> = { base: 0, ricezioni: 1, completo: 2 };

export function higherLevel(a: ScoutLevel, b: ScoutLevel): ScoutLevel {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a;
}

/** Ci sono tocchi segnati (ricezioni, attacchi…)? */
export function hasTouches(data: Pick<ScoutData, "events">): boolean {
  return data.events.some((event) => event.type === "touch");
}

/**
 * Il livello con cui leggere uno scout: quello scelto, ma se nel corso della
 * partita si sono segnati più tocchi di quanti ne prevede (si è tornati a
 * «Base» a metà) valgono quelli, perché non si nascondano numeri già segnati.
 */
export function effectiveLevel(data: Pick<ScoutData, "settings" | "events">): ScoutLevel {
  let seen: ScoutLevel = "base";
  for (const event of data.events) {
    if (event.type !== "touch") continue;
    if (event.skill !== "reception") {
      seen = "completo";
      break;
    }
    seen = "ricezioni";
  }
  return higherLevel(levelOf(data.settings), seen);
}
