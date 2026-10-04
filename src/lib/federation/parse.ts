import type { Girone, OfficialMatch, StandingRow } from "@/lib/federation/types";

/**
 * Lettura della pagina di un girone sul portale federale (stessa piattaforma
 * per udine.federvolley.it, friulivg.portalefipav.net e gli altri comitati).
 * Funzioni pure: HTML in, dati fuori, nessuna rete, così si provano con
 * pagine salvate (e2e/fixtures/federation).
 *
 * La pagina contiene due tabelle:
 * - `tbl-risultati`: Gara | G | Data / ora | Squadra casa | Squadra ospite |
 *   Risul. | Dettagli (parziali) | icone di stato e palestra;
 * - `tbl-classifica`: Pos. | Squadra | Punti | PG | PV | PP | SF | SS | QS |
 *   PF | PS | QP | Penal.
 * Le designazioni arbitrali stanno nei tooltip delle icone: non si leggono
 * mai (sono dati di persone e a noi non servono).
 */

export interface GironeParseResult {
  girone: Girone;
  /** Righe della tabella dei risultati che non si sono potute leggere
   * (data mancante o non valida, squadre vuote). */
  skippedRows: number;
  /** Vero se nella pagina c'erano entrambe le tabelle attese. */
  hasResultsTable: boolean;
  hasStandingsTable: boolean;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  agrave: "à",
  egrave: "è",
  eacute: "é",
  igrave: "ì",
  ograve: "ò",
  ugrave: "ù",
  Agrave: "À",
  Egrave: "È",
  Eacute: "É",
  deg: "°",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstTable(html: string, className: string): string | null {
  const match = html.match(
    new RegExp(`<table\\b[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>[\\s\\S]*?</table>`, "i"),
  );
  return match ? match[0] : null;
}

function rowsOf(tableHtml: string): string[] {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
}

/** Righe di una tabella con i loro attributi (serve la classe: segna la zona di classifica). */
function rowsWithAttrs(tableHtml: string): { attrs: string; html: string }[] {
  return [...tableHtml.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)].map((m) => ({ attrs: m[1], html: m[2] }));
}

/** Logo di una squadra: primo <img> della cella, reso assoluto rispetto alla
 * pagina. L'immagine «nessun logo» del portale vale null. */
function parseLogo(cellHtml: string, baseUrl?: string): string | null {
  const src = cellHtml.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1];
  if (!src || /no-image/i.test(src)) return null;
  const path = decodeEntities(src);
  if (!baseUrl) return path;
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function zoneOf(rowAttrs: string): "promotion" | "relegation" | null {
  const classes = rowAttrs.match(/\bclass="([^"]*)"/i)?.[1].toLowerCase() ?? "";
  if (classes.includes("promozione")) return "promotion";
  if (classes.includes("retrocessione")) return "relegation";
  return null;
}

function cellsOf(rowHtml: string, tag: "td" | "th" = "td"): { attrs: string; html: string }[] {
  return [...rowHtml.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => ({
    attrs: m[1],
    html: m[2],
  }));
}

function toInt(text: string): number | null {
  const clean = text.replace(/\s/g, "");
  return /^-?\d+$/.test(clean) ? parseInt(clean, 10) : null;
}

/** "18/10/26 11:00" → "2026-10-18T11:00". Null se non è una data valida. */
function parseDateTime(text: string): string | null {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

function titleOf(html: string, srcPart: string): string | null {
  const img = html.match(new RegExp(`<img\\b[^>]*src="[^"]*${srcPart}[^"]*"[^>]*>`, "i"));
  if (!img) return null;
  const title = img[0].match(/\btitle="([^"]*)"/i);
  return title ? decodeEntities(title[1]) : null;
}

/** Stato della gara: prima riga del tooltip dell'icona di stato. Il resto
 * (es. «Arbitro designato» e il suo nome) si scarta. */
function parseStatus(html: string): string {
  const title = titleOf(html, "statogara/");
  if (!title) return "";
  return stripTags(title.split(/<br\s*\/?>/i)[0]);
}

/** Palestra: primo paragrafo del tooltip dell'icona info (nome, comune,
 * indirizzo). Il paragrafo delle designazioni arbitrali si ignora. */
function parseVenue(html: string): string | null {
  const title = titleOf(html, "info_16");
  if (!title) return null;
  const paragraph = title.match(/<p\b(?![^>]*designazione)[^>]*>([\s\S]*?)<\/p>/i);
  if (!paragraph) return null;
  const lines = paragraph[1]
    .split(/<br\s*\/?>/i)
    .map((part) => stripTags(part))
    .filter(Boolean);
  return lines.length > 0 ? lines.join(", ") : null;
}

/** Nome della società: attributo `title` della cella della squadra. */
function parseClub(attrs: string): string | null {
  const title = attrs.match(/\btitle="([^"]*)"/i);
  const club = title ? stripTags(title[1]) : "";
  return club || null;
}

function parseSets(html: string): { home: number; away: number }[] {
  const sets: { home: number; away: number }[] = [];
  for (const m of html.matchAll(/<span\b[^>]*class="[^"]*\bparziali\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)) {
    const pair = stripTags(m[1]).match(/^(\d+)\s*-\s*(\d+)$/);
    if (pair) sets.push({ home: Number(pair[1]), away: Number(pair[2]) });
  }
  return sets;
}

function parseMatches(tableHtml: string): { matches: OfficialMatch[]; skippedRows: number } {
  const matches: OfficialMatch[] = [];
  let skippedRows = 0;

  for (const row of rowsOf(tableHtml)) {
    const cells = cellsOf(row);
    // La riga di intestazione ha solo <th>: nessuna cella <td>.
    if (cells.length < 6) continue;

    const externalId = stripTags(cells[0].html);
    const round = toInt(stripTags(cells[1].html));
    const date = parseDateTime(stripTags(cells[2].html));
    const home = stripTags(cells[3].html);
    const away = stripTags(cells[4].html);
    if (!externalId || !date || !home || !away) {
      skippedRows += 1;
      continue;
    }

    const score = stripTags(cells[5].html).match(/^(\d+)\s*-\s*(\d+)$/);
    const homeSets = score ? Number(score[1]) : null;
    const awaySets = score ? Number(score[2]) : null;

    // I parziali valgono solo se tornano con il risultato: altrimenti si
    // mostra il risultato ma non si propongono set incoerenti.
    let sets: { home: number; away: number }[] | null = null;
    if (score && cells[6]) {
      const parsed = parseSets(cells[6].html);
      const homeWins = parsed.filter((s) => s.home > s.away).length;
      const awayWins = parsed.filter((s) => s.away > s.home).length;
      if (parsed.length > 0 && homeWins === homeSets && awayWins === awaySets) sets = parsed;
    }

    const lastCell = cells[cells.length - 1].html;
    matches.push({
      externalId,
      round,
      date,
      home,
      away,
      homeClub: parseClub(cells[3].attrs),
      awayClub: parseClub(cells[4].attrs),
      venue: parseVenue(lastCell),
      homeSets,
      awaySets,
      sets,
      status: parseStatus(lastCell),
    });
  }

  return { matches, skippedRows };
}

function parseStandings(tableHtml: string, baseUrl?: string): StandingRow[] {
  const rows = rowsWithAttrs(tableHtml);
  const header = rows.map((r) => cellsOf(r.html, "th")).find((cells) => cells.length > 0);
  if (!header) return [];

  const index = new Map<string, number>();
  header.forEach((cell, i) => index.set(stripTags(cell.html).toLowerCase().replace(/\./g, ""), i));
  const col = (name: string) => index.get(name);
  const needed = ["pos", "squadra", "punti", "pg", "pv", "pp", "sf", "ss", "pf", "ps"];
  if (needed.some((name) => col(name) === undefined)) return [];

  const standings: StandingRow[] = [];
  for (const row of rows) {
    const cells = cellsOf(row.html);
    if (cells.length === 0) continue;
    const text = (name: string) => stripTags(cells[col(name)!]?.html ?? "");
    const num = (name: string) => toInt(text(name));
    const position = num("pos");
    const team = text("squadra");
    const points = num("punti");
    const played = num("pg");
    const won = num("pv");
    const lost = num("pp");
    const setsFor = num("sf");
    const setsAgainst = num("ss");
    const pointsFor = num("pf");
    const pointsAgainst = num("ps");
    if (
      position === null ||
      !team ||
      points === null ||
      played === null ||
      won === null ||
      lost === null ||
      setsFor === null ||
      setsAgainst === null ||
      pointsFor === null ||
      pointsAgainst === null
    ) {
      continue;
    }
    // La penalizzazione può mancare o essere vuota: vale zero.
    const penalty = col("penal") !== undefined ? (num("penal") ?? 0) : 0;
    standings.push({
      position,
      team,
      points,
      played,
      won,
      lost,
      setsFor,
      setsAgainst,
      pointsFor,
      pointsAgainst,
      penalty,
      logoUrl: parseLogo(cells[col("squadra")!]?.html ?? "", baseUrl),
      zone: zoneOf(row.attrs),
    });
  }
  return standings.sort((a, b) => a.position - b.position);
}

/** `baseUrl` è l'indirizzo della pagina: serve a rendere assoluti i loghi. */
export function parseGirone(html: string, baseUrl?: string): GironeParseResult {
  const resultsTable = firstTable(html, "tbl-risultati");
  const standingsTable = firstTable(html, "tbl-classifica");
  const { matches, skippedRows } = resultsTable ? parseMatches(resultsTable) : { matches: [], skippedRows: 0 };
  const standings = standingsTable ? parseStandings(standingsTable, baseUrl) : [];
  return {
    girone: { matches, standings },
    skippedRows,
    hasResultsTable: resultsTable !== null,
    hasStandingsTable: standingsTable !== null,
  };
}

/**
 * Controllo di plausibilità prima di sostituire l'ultimo contenuto valido:
 * se il portale cambia pagina o risponde con un errore, meglio tenere i dati
 * vecchi (con la loro data) che mostrare una classifica vuota o sbagliata.
 * Restituisce il motivo del rifiuto, oppure null se i dati sono accettabili.
 */
export function validateGirone(result: GironeParseResult): string | null {
  const { girone, skippedRows, hasResultsTable, hasStandingsTable } = result;
  if (!hasResultsTable || !hasStandingsTable) {
    return "La pagina del girone non contiene le tabelle attese (il portale potrebbe essere cambiato).";
  }
  if (girone.standings.length < 2) {
    return "La classifica letta ha meno di due squadre.";
  }
  if (new Set(girone.standings.map((s) => s.position)).size !== girone.standings.length) {
    return "La classifica letta ha posizioni duplicate.";
  }
  if (girone.matches.length === 0) {
    return "Non è stata letta nessuna gara dal calendario del girone.";
  }
  if (skippedRows > girone.matches.length / 2) {
    return "Troppe righe del calendario non sono leggibili (il portale potrebbe essere cambiato).";
  }
  return null;
}
