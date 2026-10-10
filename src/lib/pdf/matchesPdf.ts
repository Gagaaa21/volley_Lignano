import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { todayIso } from "@/lib/today";
import type { Category, Match } from "@/lib/types";
import { PdfReport, type PdfCell, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";

/**
 * PDF con tutte le partite: lo stesso documento per il sito pubblico (chi
 * scarica è una famiglia) e per lo staff. Ritrovo e note sono già pubblici sul
 * sito, quindi stanno in entrambi; lo staff in più vede la dicitura «da
 * inserire» sui risultati mancanti. Formazioni e convocazioni non ci sono.
 * Due sezioni come nell'elenco delle partite: «Prossime partite» dalla più
 * vicina e «Partite giocate» dalla più recente.
 */

export type MatchesPdfAudience = "public" | "staff";

export interface MatchesPdfInput {
  matches: Match[];
  audience: MatchesPdfAudience;
  /** Solo una categoria, o null per tutte. */
  category: Category | null;
  /** Oggi, "YYYY-MM-DD" (iniettabile per i test). */
  today?: string;
  generatedAt?: Date;
}

function dateLabel(iso: string): string {
  return format(parseISO(iso.slice(0, 10)), "EEE d MMM yyyy", { locale: it });
}

function categoryCell(match: Match): PdfCell {
  return {
    text: match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL,
    bold: true,
    tone: match.category === "U14" ? "u14" : match.category === "U15" ? "u15" : "default",
  };
}

function opponentCell(match: Match): PdfCell {
  const tags = [match.isFriendly ? "Amichevole" : null, match.isTournament ? "Torneo" : null].filter(Boolean);
  return { text: matchTitle(match), bold: true, sub: tags.length > 0 ? tags.join(" · ") : undefined };
}

function sideCell(match: Match): PdfCell {
  return { text: match.isHome ? "Casa" : "Trasferta" };
}

const sets = (scores: { us: number; them: number }[]) => scores.map((s) => `${s.us}-${s.them}`).join(" · ");

/** Parziali: per un torneo una riga per ogni avversaria affrontata. */
function partialsText(match: Match): string {
  if (match.isTournament) {
    return (match.tournamentGames ?? [])
      .filter((g) => g.setScores.length > 0)
      .map((g) => `vs ${g.opponent}: ${sets(g.setScores)}`)
      .join("\n");
  }
  return sets(match.setScores ?? []);
}

function resultCell(match: Match, audience: MatchesPdfAudience): PdfCell {
  if (!match.isTournament && match.resultSetsWon !== null && match.resultSetsLost !== null) {
    const won = match.resultSetsWon > match.resultSetsLost;
    return {
      text: `${match.resultSetsWon}–${match.resultSetsLost}`,
      bold: true,
      tone: won ? "success" : "danger",
      sub: won ? "Vinta" : "Persa",
    };
  }
  if (audience === "staff" && !match.isTournament) return { text: "Da inserire", tone: "muted" };
  return { text: "—", tone: "muted" };
}

function locationCell(match: Match): PdfCell {
  const meeting =
    match.meetingTime || match.meetingLocation
      ? `Ritrovo${match.meetingTime ? ` ore ${match.meetingTime}` : ""}${match.meetingLocation ? ` · ${match.meetingLocation}` : ""}`
      : null;
  const note = match.notes ? `Note: ${match.notes}` : null;
  const sub = [meeting, note].filter(Boolean).join("\n");
  return { text: match.location, sub: sub || undefined };
}

/** Vittorie e sconfitte di campionato: come il bilancio stagione del sito, senza amichevoli né tornei. */
function leagueRecord(matches: Match[]): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const m of matches) {
    if (m.isFriendly || m.isTournament || m.resultSetsWon === null || m.resultSetsLost === null) continue;
    if (m.resultSetsWon > m.resultSetsLost) wins++;
    else losses++;
  }
  return { wins, losses };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function matchesPdfTitle(category: Category | null): string {
  return category ? `Calendario partite ${CATEGORY_LABELS[category]}` : "Calendario partite";
}

export async function buildMatchesPdf(input: MatchesPdfInput): Promise<Uint8Array> {
  const { audience, category } = input;
  const today = input.today ?? todayIso();
  const matches = input.matches.filter((m) => !category || m.category === category);

  const upcoming = matches
    .filter((m) => m.matchDate.slice(0, 10) >= today)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const played = matches
    .filter((m) => m.matchDate.slice(0, 10) < today)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate));

  const showCategory = !category;
  const scope = category ? CATEGORY_LABELS[category] : "Under 14 e Under 15";

  const report = await PdfReport.create({
    title: "Calendario partite",
    subtitle: `${scope} · ${plural(matches.length, "partita", "partite")}`,
    documentTitle: matchesPdfTitle(category),
    footerLabel: audience === "public" ? "Volley Lignano · calendario partite" : "Volley Lignano · riservato allo staff",
    generatedAt: input.generatedAt,
  });

  /** La colonna Categoria c'è solo quando il documento mostra più categorie. */
  const categoryOnly = <T,>(item: T): T[] => (showCategory ? [item] : []);

  // ── Prossime partite ──────────────────────────────────────────────
  const upcomingColumns: PdfColumn[] = [
    { header: "Data", weight: 1.9 },
    { header: "Ora", weight: 0.8 },
    ...categoryOnly<PdfColumn>({ header: "Categoria", weight: 1.2 }),
    { header: "Avversaria", weight: 2.6 },
    { header: "Casa / trasferta", weight: 1.2 },
    { header: "Luogo", weight: 2.9 },
  ];
  const upcomingRows: PdfCellInput[][] = upcoming.map((m) => [
    { text: dateLabel(m.matchDate), bold: true },
    m.matchDate.slice(11, 16),
    ...categoryOnly<PdfCellInput>(categoryCell(m)),
    opponentCell(m),
    sideCell(m),
    locationCell(m),
  ]);
  report.heading("Prossime partite", plural(upcoming.length, "partita", "partite"));
  report.table(upcomingColumns, upcomingRows, { emptyText: "Nessuna partita in programma al momento." });

  // ── Partite giocate ───────────────────────────────────────────────
  const record = leagueRecord(played);
  const playedDetail =
    record.wins + record.losses > 0
      ? `Campionato: ${plural(record.wins, "vinta", "vinte")} · ${plural(record.losses, "persa", "perse")}`
      : plural(played.length, "partita", "partite");
  const playedColumns: PdfColumn[] = [
    { header: "Data", weight: 1.9 },
    ...categoryOnly<PdfColumn>({ header: "Categoria", weight: 1.2 }),
    { header: "Avversaria", weight: 2.6 },
    { header: "Casa / trasferta", weight: 1.2 },
    { header: "Risultato", weight: 1.2, align: "center" },
    { header: "Parziali", weight: 2.7 },
  ];
  const playedRows: PdfCellInput[][] = played.map((m) => {
    const partials = partialsText(m);
    return [
      { text: dateLabel(m.matchDate), bold: true },
      ...categoryOnly<PdfCellInput>(categoryCell(m)),
      opponentCell(m),
      sideCell(m),
      resultCell(m, audience),
      { text: partials || "—", tone: partials ? "default" : "muted" },
    ];
  });
  report.heading("Partite giocate", playedDetail);
  report.table(playedColumns, playedRows, { emptyText: "Nessuna partita giocata finora." });

  return report.finish();
}
