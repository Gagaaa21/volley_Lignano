import { formatDateLong, formatDateShort } from "@/lib/format";
import { OVERVIEW_METRICS, formatDelta, formatMeasure } from "@/lib/physicalTestOverview";
import {
  VIEW_LABELS,
  averagesByMetric,
  bestByMetric,
  buildRows,
  filterOverviewAthletes,
  sortRows,
  type OverviewAthlete,
  type TableParams,
} from "@/lib/physicalTestTable";
import type { TrainingTeam } from "@/lib/types";
import { PdfReport, type PdfCellInput, type PdfColumn } from "@/lib/pdf/report";

/**
 * Riepilogo dei test fisici da stampare: la stessa tabella che si vede a
 * schermo (vista, giorno, filtri e ordine arrivano dall'indirizzo), in
 * orizzontale perché le colonne sono molte.
 */
export async function buildPhysicalTestsPdf(input: {
  team: TrainingTeam;
  athletes: OverviewAthlete[];
  params: TableParams;
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { athletes, params, team } = input;

  // Come nella pagina: senza un giorno scelto si parte dal più recente.
  const days = new Map<string, number>();
  for (const athlete of athletes) for (const s of athlete.sessions) days.set(s.date, (days.get(s.date) ?? 0) + 1);
  const day = params.day || [...days.keys()].sort().reverse()[0] || "";

  const visible = filterOverviewAthletes(athletes, params.query, params.label);
  const rows = sortRows(buildRows(visible, params.view, day, params.includeEmpty), params.sort);
  const best = bestByMetric(rows);
  const averages = averagesByMetric(rows);
  const hasOthers = rows.some((r) => r.others.length > 0);
  const testedCount = rows.filter((r) => r.date !== null).length;
  const missingOnDay = params.view === "giorno" ? visible.filter((a) => !a.sessions.some((s) => s.date === day)) : [];

  const viewLabel =
    params.view === "giorno" && day ? `Giornata del ${formatDateLong(day)}` : VIEW_LABELS[params.view];
  const filters = [params.label || null, params.query.trim() ? `ricerca «${params.query.trim()}»` : null].filter(Boolean);
  const scope = team === "minivolley" ? "Minivolley" : "Under 14 e Under 15";

  const report = await PdfReport.create({
    title: "Test fisici",
    // Con un filtro per categoria il filtro stesso dice già di chi si parla.
    subtitle: [viewLabel, ...filters, params.label ? null : scope].filter(Boolean).join(" · "),
    footerLabel: "Volley Lignano · riservato allo staff",
    orientation: "landscape",
    theme: team === "minivolley" ? "minivolley" : "u14u15",
    generatedAt: input.generatedAt,
  });

  const columns: PdfColumn[] = [
    { header: "Atleta", weight: 2.4 },
    { header: params.view === "ultimo" ? "Ultimo test" : "Data", weight: 1.25 },
    ...OVERVIEW_METRICS.map((m): PdfColumn => ({ header: `${m.label} (${m.unit})`, weight: 1.05, align: "right" })),
    ...(hasOthers ? [{ header: "Altri dati", weight: 2.2 } as PdfColumn] : []),
  ];

  const tableRows: PdfCellInput[][] = rows.map((row) => [
    { text: row.athlete.fullName, bold: true, sub: row.athlete.label ?? undefined },
    row.date ? formatDateShort(row.date) : { text: "Nessun test", tone: "muted" },
    ...OVERVIEW_METRICS.map((metric): PdfCellInput => {
      const reading = row.readings[metric.key];
      if (!reading) return { text: "—", tone: "muted" };
      const isBest = best[metric.key] === reading.value;
      const delta = reading.previous !== null ? formatDelta(reading.value, reading.previous) : null;
      // In «Ultimi risultati» una misura può essere di un giorno diverso dall'ultima sessione: lo si dice.
      const otherDay = params.view === "ultimo" && row.date !== reading.date ? formatDateShort(reading.date) : null;
      const improved = reading.previous !== null && reading.value > reading.previous;
      return {
        text: formatMeasure(reading.value),
        bold: true,
        tone: isBest ? "success" : "default",
        sub: [delta, otherDay].filter(Boolean).join("\n") || undefined,
        subTone: otherDay || !delta || metric.kind !== "jump" ? "muted" : improved ? "success" : "danger",
      };
    }),
    ...(hasOthers ? [row.others.map((o) => `${o.name}: ${o.value}`).join("\n")] : []),
  ]);

  if (rows.length > 0) {
    tableRows.push([
      { text: "Media", bold: true, tone: "primary" },
      { text: `${testedCount} ${testedCount === 1 ? "riga" : "righe"}`, tone: "muted" },
      ...OVERVIEW_METRICS.map((m): PdfCellInput => {
        const value = averages[m.key];
        return value === null ? { text: "—", tone: "muted" } : { text: formatMeasure(value), bold: true, tone: "primary" };
      }),
      ...(hasOthers ? [""] : []),
    ]);
  }

  report.heading(viewLabel, `${rows.length} ${rows.length === 1 ? "riga" : "righe"}`);
  report.table(columns, tableRows, { emptyText: "Nessun risultato per questi filtri." });

  if (missingOnDay.length > 0) {
    report.text(`Senza test in questo giorno (${missingOnDay.length}): ${missingOnDay.map((a) => a.fullName).join(", ")}.`, {
      size: 8.5,
    });
  }
  report.text(
    "I salti sono la media dei tentativi della sessione. Sotto ogni numero la variazione rispetto alla misura precedente della stessa atleta; in verde il valore più alto di ogni salto.",
    { size: 8 },
  );

  return report.finish();
}
