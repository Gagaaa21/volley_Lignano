import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import type { Athlete, Match } from "@/lib/types";
import { PdfReport, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";
import { categoryTone } from "@/lib/pdf/matchesPdf";

/**
 * Le convocazioni di una partita in PDF, da mandare a famiglie e atlete: la partita, il ritrovo e chi è convocata (con il numero
 * di maglia, se c'è). Solo quello: niente formazioni, note, segnalazioni di non disponibilità né numeri di telefono. I nomi delle
 * convocate sono già pubblici sul calendario del sito, quindi il foglio non dice niente di nuovo.
 *
 * `convocationPdfContent` decide cosa finisce nel foglio (testi semplici, senza impaginazione): è la parte che si prova, perché
 * quello che non ci passa non può comparire nel PDF.
 */

export interface ConvocationPdfInput {
  match: Match;
  /** Le convocate: quelle salvate nella partita, o la selezione di chi sta preparando il foglio. */
  athletes: readonly Pick<Athlete, "id" | "fullName" | "jerseyNumber">[];
  generatedAt?: Date;
}

export interface ConvocationPdfRow {
  /** Il numero di maglia, se l'atleta ce l'ha. */
  number: number | null;
  name: string;
}

export interface ConvocationPdfContent {
  title: string;
  /** «21 novembre 2026 · ore 18:00 · Casa» (con «Amichevole» o «Torneo» se non è di campionato). */
  when: string;
  place: string;
  /** Il ritrovo, se la partita ne ha uno. */
  meeting: string | null;
  total: string;
  rows: ConvocationPdfRow[];
  /** Si scrive la colonna dei numeri solo se almeno un'atleta ne ha uno. */
  withNumbers: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Quanti nominativi al massimo si leggono dall'indirizzo (una squadra ne ha una trentina). */
export const MAX_CONVOCATION_IDS = 100;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Chi finisce nel foglio: senza `ids` le convocate salvate nella partita; con, la selezione di chi prepara il foglio (anche non
 * ancora salvata), letta dall'indirizzo («a,b,c»). Quello che non ha la forma di un identificativo si scarta, i doppioni contano
 * una volta e se ne leggono al massimo `MAX_CONVOCATION_IDS`.
 */
export function resolveConvocatedIds(raw: string | null, saved: readonly string[]): Set<string> {
  if (raw === null) return new Set(saved);
  return new Set(
    raw
      .split(",")
      .filter((value) => ID_PATTERN.test(value))
      .slice(0, MAX_CONVOCATION_IDS),
  );
}

export function convocationPdfTitle(match: Match): string {
  return `Convocazioni ${matchTitle(match)}`;
}

/** Chi ha il numero in ordine di numero, poi le altre in ordine alfabetico. */
export function sortConvocated<T extends Pick<ConvocationPdfRow, "number" | "name">>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number;
    if ((a.number === null) !== (b.number === null)) return a.number === null ? 1 : -1;
    return a.name.localeCompare(b.name, "it");
  });
}

export function convocationPdfContent(input: Omit<ConvocationPdfInput, "generatedAt">): ConvocationPdfContent {
  const { match } = input;
  const rows = sortConvocated(input.athletes.map((athlete) => ({ number: athlete.jerseyNumber, name: athlete.fullName })));
  const meeting = [match.meetingTime ? `ore ${match.meetingTime}` : null, match.meetingLocation].filter(Boolean).join(" · ");
  return {
    title: convocationPdfTitle(match),
    when: [
      formatDateLong(match.matchDate.slice(0, 10)),
      `ore ${match.matchDate.slice(11, 16)}`,
      match.isHome ? "Casa" : "Trasferta",
      match.isTournament ? "Torneo" : match.isFriendly ? "Amichevole" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    place: match.location,
    meeting: meeting || null,
    total: plural(rows.length, "convocata", "convocate"),
    rows,
    withNumbers: rows.some((row) => row.number !== null),
  };
}

export async function buildConvocationPdf(input: ConvocationPdfInput): Promise<Uint8Array> {
  const { match } = input;
  const content = convocationPdfContent(input);
  const categoryLabel = match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL;

  const report = await PdfReport.create({
    title: "Convocazioni",
    subtitle: `${categoryLabel} · ${matchTitle(match)} · ${formatDateLong(match.matchDate.slice(0, 10))}`,
    documentTitle: content.title,
    footerLabel: "Volley Lignano · convocazioni",
    generatedAt: input.generatedAt,
    tag: match.category ? { text: categoryLabel.toUpperCase(), tone: categoryTone(match.category) ?? "primary" } : undefined,
  });

  report.heading("La partita");
  report.text(content.when, { size: 11.5, bold: true, tone: "default", gapAfter: 3 });
  report.text(content.place, { size: 10, tone: "default", gapAfter: 8 });
  if (content.meeting) report.callout("info", content.meeting, { title: "Ritrovo" });
  else report.text("Ritrovo: all'orario della partita", { size: 10, tone: "default", gapAfter: 10 });

  report.spacer(6);
  report.heading("Convocate", content.total);
  const columns: PdfColumn[] = content.withNumbers
    ? [
        { header: "N°", weight: 0.8, align: "center" },
        { header: "Atleta", weight: 6 },
      ]
    : [{ header: "Atleta", weight: 1 }];
  const rows: PdfCellInput[][] = content.rows.map((row) =>
    content.withNumbers
      ? [row.number !== null ? { text: String(row.number), bold: true, tone: "primary" } : { text: "–", tone: "muted" }, { text: row.name, bold: true }]
      : [{ text: row.name, bold: true }],
  );
  report.table(columns, rows, { emptyText: "Nessuna convocata ancora." });

  return report.finish();
}
