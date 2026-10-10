import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";
import {
  OVERVIEW_METRICS,
  buildAthleteSessions,
  latestReading,
  readingAt,
  type AthleteSession,
  type MetricReading,
  type OverviewMetricKey,
} from "@/lib/physicalTestOverview";
import type { Athlete, PhysicalTest } from "@/lib/types";

/**
 * La tabella del riepilogo test fisici, senza interfaccia: righe, ordine,
 * medie. La usano sia la pagina (che filtra e ordina nel browser) sia il PDF
 * (che riceve gli stessi filtri dall'indirizzo e ricostruisce la stessa tabella).
 */

export interface OverviewAthlete {
  id: string;
  fullName: string;
  isActive: boolean;
  /** Categoria (U14/U15) o gruppo (Minivolley), se assegnata. */
  label: string | null;
  tone: "u14" | "u15" | "neutral";
  /** Sessioni dalla più recente. */
  sessions: AthleteSession[];
}

export type View = "ultimo" | "giorno" | "tutte";
export type SortColumn = "name" | "date" | OverviewMetricKey;
export interface Sort {
  column: SortColumn;
  direction: "asc" | "desc";
}

export interface OverviewRow {
  key: string;
  athlete: OverviewAthlete;
  /** Giorno della sessione mostrata; per "ultimo" è quello dell'ultima sessione. */
  date: string | null;
  readings: Partial<Record<OverviewMetricKey, MetricReading>>;
  others: { name: string; value: string }[];
}

export const VIEW_LABELS: Record<View, string> = {
  ultimo: "Ultimi risultati",
  giorno: "Un giorno",
  tutte: "Tutte le sessioni",
};

export const DEFAULT_SORT: Record<View, Sort> = {
  ultimo: { column: "name", direction: "asc" },
  giorno: { column: "name", direction: "asc" },
  tutte: { column: "date", direction: "desc" },
};

/** Le atlete del riepilogo con le loro sessioni di test (un'atleta non più attiva resta solo se ha dati). */
export function buildOverviewAthletes(tests: PhysicalTest[], athletes: Athlete[]): OverviewAthlete[] {
  const testsByAthlete = new Map<string, PhysicalTest[]>();
  for (const test of tests) {
    const list = testsByAthlete.get(test.athleteId);
    if (list) list.push(test);
    else testsByAthlete.set(test.athleteId, [test]);
  }

  return athletes
    .map(
      (athlete): OverviewAthlete => ({
        id: athlete.id,
        fullName: athlete.fullName,
        isActive: athlete.isActive,
        label: athlete.category
          ? CATEGORY_LABELS[athlete.category]
          : athlete.group
            ? MINIVOLLEY_GROUP_LABELS[athlete.group]
            : null,
        tone: athlete.category === "U14" ? "u14" : athlete.category === "U15" ? "u15" : "neutral",
        sessions: buildAthleteSessions(testsByAthlete.get(athlete.id) ?? []),
      }),
    )
    .filter((athlete) => athlete.isActive || athlete.sessions.length > 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
}

/** Atlete che passano la ricerca per nome e il filtro per categoria/gruppo. */
export function filterOverviewAthletes(athletes: OverviewAthlete[], query: string, label: string): OverviewAthlete[] {
  const q = query.trim().toLowerCase();
  return athletes.filter((a) => (!q || a.fullName.toLowerCase().includes(q)) && (!label || a.label === label));
}

export function buildRows(athletes: OverviewAthlete[], view: View, day: string, includeEmpty: boolean): OverviewRow[] {
  const rows: OverviewRow[] = [];
  for (const athlete of athletes) {
    const { sessions } = athlete;
    if (view === "ultimo") {
      if (sessions.length === 0 && !includeEmpty) continue;
      const readings: OverviewRow["readings"] = {};
      for (const metric of OVERVIEW_METRICS) {
        const reading = latestReading(sessions, metric.key);
        if (reading) readings[metric.key] = reading;
      }
      rows.push({
        key: athlete.id,
        athlete,
        date: sessions[0]?.date ?? null,
        readings,
        others: sessions[0]?.others ?? [],
      });
    } else {
      sessions.forEach((session, index) => {
        if (view === "giorno" && session.date !== day) return;
        const readings: OverviewRow["readings"] = {};
        for (const metric of OVERVIEW_METRICS) {
          const reading = readingAt(sessions, index, metric.key);
          if (reading) readings[metric.key] = reading;
        }
        rows.push({ key: `${athlete.id}_${session.date}`, athlete, date: session.date, readings, others: session.others });
      });
    }
  }
  return rows;
}

export function sortRows(rows: OverviewRow[], sort: Sort): OverviewRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const byName = (a: OverviewRow, b: OverviewRow) => a.athlete.fullName.localeCompare(b.athlete.fullName, "it");
  return [...rows].sort((a, b) => {
    if (sort.column === "name") return factor * byName(a, b);
    if (sort.column === "date") {
      // Senza data (nessun test) sempre in fondo.
      if (!a.date || !b.date) return a.date === b.date ? byName(a, b) : a.date ? -1 : 1;
      return factor * a.date.localeCompare(b.date) || byName(a, b);
    }
    const av = a.readings[sort.column]?.value;
    const bv = b.readings[sort.column]?.value;
    // Chi non ha il valore va in fondo, comunque si ordini.
    if (av === undefined || bv === undefined) return av === bv ? byName(a, b) : av === undefined ? 1 : -1;
    return factor * (av - bv) || byName(a, b);
  });
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Il valore più alto di ogni salto: ha senso solo se c'è da confrontare (più di un valore). */
export function bestByMetric(rows: OverviewRow[]): Partial<Record<OverviewMetricKey, number>> {
  const best: Partial<Record<OverviewMetricKey, number>> = {};
  for (const metric of OVERVIEW_METRICS) {
    if (metric.kind !== "jump") continue;
    const values = rows.map((r) => r.readings[metric.key]?.value).filter((v): v is number => v !== undefined);
    if (values.length > 1) best[metric.key] = Math.max(...values);
  }
  return best;
}

/** Media di ogni misura sulle righe mostrate. */
export function averagesByMetric(rows: OverviewRow[]): Record<OverviewMetricKey, number | null> {
  return Object.fromEntries(
    OVERVIEW_METRICS.map((metric) => [
      metric.key,
      mean(rows.map((r) => r.readings[metric.key]?.value).filter((v): v is number => v !== undefined)),
    ]),
  ) as Record<OverviewMetricKey, number | null>;
}

const SORT_COLUMNS = new Set<string>(["name", "date", ...OVERVIEW_METRICS.map((m) => m.key)]);

/** Parametri della tabella nell'indirizzo (per il PDF): ogni valore è controllato, uno sbagliato torna al predefinito. */
export interface TableParams {
  view: View;
  day: string;
  query: string;
  label: string;
  includeEmpty: boolean;
  sort: Sort;
}

export function parseTableParams(search: URLSearchParams): TableParams {
  const rawView = search.get("view");
  const view: View = rawView === "giorno" || rawView === "tutte" ? rawView : "ultimo";
  const rawDay = search.get("day") ?? "";
  const rawColumn = search.get("sort") ?? "";
  const rawDirection = search.get("dir");
  const sort: Sort = SORT_COLUMNS.has(rawColumn)
    ? { column: rawColumn as SortColumn, direction: rawDirection === "asc" || rawDirection === "desc" ? rawDirection : DEFAULT_SORT[view].direction }
    : DEFAULT_SORT[view];
  return {
    view,
    day: /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : "",
    query: (search.get("q") ?? "").slice(0, 80),
    label: (search.get("label") ?? "").slice(0, 40),
    includeEmpty: search.get("empty") === "1",
    sort,
  };
}

/** L'indirizzo del PDF con gli stessi filtri che si vedono a schermo. */
export function tableParamsToSearch(params: TableParams): string {
  const search = new URLSearchParams();
  search.set("view", params.view);
  if (params.view === "giorno" && params.day) search.set("day", params.day);
  if (params.query.trim()) search.set("q", params.query.trim());
  if (params.label) search.set("label", params.label);
  if (params.includeEmpty) search.set("empty", "1");
  search.set("sort", params.sort.column);
  search.set("dir", params.sort.direction);
  return search.toString();
}
