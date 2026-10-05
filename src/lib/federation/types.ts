import type { Category } from "@/lib/types";

/** Una gara del girone così com'è pubblicata dal portale federale
 * (udine.federvolley.it e gli altri comitati, stessa piattaforma). */
export interface OfficialMatch {
  /** Numero gara: identifica la partita nel girone. */
  externalId: string;
  /** Numero di giornata, se indicato. */
  round: number | null;
  /** Data e ora locali, "YYYY-MM-DDTHH:MM" (stesso formato di Match.matchDate). */
  date: string;
  home: string;
  away: string;
  /** Società a cui appartiene ogni squadra (es. «VOLLEY CIVIDALE A.S.D.» per
   * «ASFJR 1971»): aiuta a riconoscere l'avversaria. Null se non indicata. */
  homeClub: string | null;
  awayClub: string | null;
  /** Palestra e indirizzo, se indicati. */
  venue: string | null;
  /** Set vinti dalla squadra di casa e da quella ospite. Null se la gara non
   * ha ancora un risultato. */
  homeSets: number | null;
  awaySets: number | null;
  /** Parziali di ogni set in ordine di gioco, punti di casa e punti ospite.
   * Null se la gara non ha ancora un risultato. */
  sets: { home: number; away: number }[] | null;
  /** Stato della gara, testo del portale (es. "da disputare", "risultato
   * ufficioso"): lo si mostra com'è, senza interpretarlo. */
  status: string;
}

export interface StandingRow {
  position: number;
  team: string;
  points: number;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  penalty: number;
  /** Logo della squadra sul portale (indirizzo completo). Assente nei dati
   * letti prima che i loghi venissero salvati; null se la squadra non ne ha. */
  logoUrl?: string | null;
  /** Fascia di classifica segnata dal portale (es. le righe verdi della
   * «promozione»). Assente nei dati più vecchi. */
  zone?: "promotion" | "relegation" | null;
}

/** Contenuto letto da una pagina di girone. */
export interface Girone {
  matches: OfficialMatch[];
  standings: StandingRow[];
}

/** Dove leggere il girone di una categoria. Il Developer la modifica dal
 * Centro di controllo, niente indirizzi scritti nel codice. */
export interface FederationSource {
  category: Category;
  /** Indirizzo della pagina del girone sul portale; null se non ancora
   * pubblicato (la categoria resta semplicemente nascosta). */
  url: string | null;
  /** Nomi con cui la nostra squadra compare nel girone (es. "CDA VOLLEY LIGNANO"). */
  teamAliases: string[];
  enabled: boolean;
  updatedAt: string | null;
}

export type FederationSourceInput = Pick<FederationSource, "url" | "teamAliases" | "enabled">;

/** Ultimo contenuto letto con successo per una categoria, più l'ultimo
 * errore di lettura (se c'è). Una lettura fallita non cancella mai il
 * contenuto precedente. */
export interface FederationSnapshot {
  category: Category;
  girone: Girone | null;
  fetchedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

/** Cosa ha deciso un admin su una gara ufficiale: abbinata a una partita del
 * sito (così non si riabbina ogni volta) oppure scartata (non va riproposta). */
export interface FederationDecision {
  category: Category;
  externalId: string;
  decision: "linked" | "dismissed";
  matchId: string | null;
  decidedBy: string | null;
  decidedAt: string;
}

export type FederationDecisionInput = Omit<FederationDecision, "decidedAt">;

/** Impostazioni di partenza (U15 girone A di Udine, dalla stagione 2026/27).
 * Usate dalla modalità demo e come valori di riserva se la tabella è vuota.
 * U14 resta senza indirizzo qui, così demo e test non leggono il portale vero:
 * l'indirizzo del girone U14 si imposta dal Centro di controllo (o dal seed
 * di supabase/schema.sql per una nuova installazione). */
export const DEFAULT_FEDERATION_SOURCES: Record<Category, Omit<FederationSource, "updatedAt">> = {
  U14: { category: "U14", url: null, teamAliases: ["CDA VOLLEY LIGNANO"], enabled: true },
  U15: {
    category: "U15",
    url: "https://udine.federvolley.it/risultati-classifiche.aspx?ComitatoId=48&StId=2428&DataDa=&StatoGara=&CId=93676&SId=&PId=15544&btFiltro=CERCA",
    teamAliases: ["CDA VOLLEY LIGNANO"],
    enabled: true,
  },
};
