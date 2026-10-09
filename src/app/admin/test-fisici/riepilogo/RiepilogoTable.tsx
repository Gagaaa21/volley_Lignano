"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";
import { Avatar, type AvatarTone } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { buildCsv } from "@/lib/csv";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import {
  OVERVIEW_METRICS,
  formatDelta,
  formatMeasure,
  latestReading,
  readingAt,
  type AthleteSession,
  type MetricReading,
  type OverviewMetric,
  type OverviewMetricKey,
} from "@/lib/physicalTestOverview";

export interface OverviewAthlete {
  id: string;
  fullName: string;
  isActive: boolean;
  /** Categoria (U14/U15) o gruppo (Minivolley), se assegnata. */
  label: string | null;
  tone: AvatarTone;
  /** Sessioni dalla più recente. */
  sessions: AthleteSession[];
}

type View = "ultimo" | "giorno" | "tutte";
type SortColumn = "name" | "date" | OverviewMetricKey;
interface Sort {
  column: SortColumn;
  direction: "asc" | "desc";
}

interface Row {
  key: string;
  athlete: OverviewAthlete;
  /** Giorno della sessione mostrata; per "ultimo" è quello dell'ultima sessione. */
  date: string | null;
  readings: Partial<Record<OverviewMetricKey, MetricReading>>;
  others: { name: string; value: string }[];
}

const VIEW_LABELS: Record<View, string> = {
  ultimo: "Ultimi risultati",
  giorno: "Un giorno",
  tutte: "Tutte le sessioni",
};

const DEFAULT_SORT: Record<View, Sort> = {
  ultimo: { column: "name", direction: "asc" },
  giorno: { column: "name", direction: "asc" },
  tutte: { column: "date", direction: "desc" },
};

function buildRows(athletes: OverviewAthlete[], view: View, day: string, includeEmpty: boolean): Row[] {
  const rows: Row[] = [];
  for (const athlete of athletes) {
    const { sessions } = athlete;
    if (view === "ultimo") {
      if (sessions.length === 0 && !includeEmpty) continue;
      const readings: Row["readings"] = {};
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
        const readings: Row["readings"] = {};
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

function sortRows(rows: Row[], sort: Sort): Row[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const byName = (a: Row, b: Row) => a.athlete.fullName.localeCompare(b.athlete.fullName, "it");
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

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Numero per il CSV: punto decimale (la virgola separa le colonne), al massimo due decimali. */
function csvNumber(value: number | undefined): string {
  return value === undefined ? "" : String(Math.round(value * 100) / 100);
}

function SortHeader({
  label,
  sublabel,
  column,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  sublabel?: string;
  column: SortColumn;
  sort: Sort;
  onSort: (column: SortColumn) => void;
  align?: "left" | "right";
}) {
  const active = sort.column === column;
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2.5 align-bottom font-semibold", align === "right" ? "text-right" : "text-left")}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "group inline-flex flex-col gap-0.5 rounded-md text-xs uppercase tracking-wide transition-colors hover:text-foreground",
          align === "right" ? "items-end" : "items-start",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <Icon className={cn("h-3 w-3", !active && "opacity-40 group-hover:opacity-80")} />
        </span>
        {sublabel && <span className="text-[10px] font-medium normal-case tracking-normal opacity-70">{sublabel}</span>}
      </button>
    </th>
  );
}

function MetricCell({
  metric,
  reading,
  isBest,
  showDate,
  rowDate,
}: {
  metric: OverviewMetric;
  reading: MetricReading | undefined;
  isBest: boolean;
  /** In "Ultimi risultati" una misura può essere di un giorno diverso dall'ultima sessione: lo si dice. */
  showDate: boolean;
  rowDate: string | null;
}) {
  if (!reading) return <td className="px-3 py-2.5 text-right text-muted-foreground/50">—</td>;
  const delta = reading.previous !== null ? formatDelta(reading.value, reading.previous) : null;
  const improved = reading.previous !== null && reading.value > reading.previous;
  return (
    <td className="px-3 py-2.5 text-right align-top">
      <span
        className={cn(
          "tabular inline-block rounded-md px-1.5 py-0.5 font-semibold text-foreground",
          isBest && "bg-success-soft text-success",
        )}
        title={isBest ? "Il valore più alto della colonna" : undefined}
      >
        {formatMeasure(reading.value)}
      </span>
      {delta && (
        <span
          className={cn(
            "tabular block text-[11px] font-semibold",
            metric.kind === "jump" ? (improved ? "text-success" : "text-destructive") : "text-muted-foreground",
          )}
          title="Rispetto alla misura precedente"
        >
          {delta}
        </span>
      )}
      {showDate && rowDate !== reading.date && (
        <span className="block text-[11px] text-muted-foreground">{formatDateShort(reading.date)}</span>
      )}
    </td>
  );
}

/**
 * Tutti i test fisici di tutte le atlete in una tabella. Tre modi di guardarla:
 * gli ultimi risultati di ognuna, una singola giornata di test (per confrontare
 * le atlete provate insieme) o tutte le sessioni di fila. Si cerca per nome, si
 * ordina con un clic sulle intestazioni e si scarica quello che si vede.
 */
export function RiepilogoTable({ athletes }: { athletes: OverviewAthlete[] }) {
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const athlete of athletes) for (const s of athlete.sessions) counts.set(s.date, (counts.get(s.date) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [athletes]);
  const labels = useMemo(() => [...new Set(athletes.map((a) => a.label).filter((l): l is string => Boolean(l)))].sort(), [athletes]);

  const [view, setView] = useState<View>("ultimo");
  const [day, setDay] = useState(days[0]?.[0] ?? "");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT.ultimo);

  function changeView(next: View) {
    setView(next);
    setSort(DEFAULT_SORT[next]);
  }
  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : // Per i risultati si parte dal più alto, per nome e data dal primo.
          { column, direction: column === "name" || column === "date" ? "asc" : "desc" },
    );
  }

  const visibleAthletes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return athletes.filter(
      (a) => (!q || a.fullName.toLowerCase().includes(q)) && (!label || a.label === label),
    );
  }, [athletes, query, label]);

  const rows = useMemo(
    () => sortRows(buildRows(visibleAthletes, view, day, includeEmpty), sort),
    [visibleAthletes, view, day, includeEmpty, sort],
  );

  const bestByMetric = useMemo(() => {
    const best: Partial<Record<OverviewMetricKey, number>> = {};
    for (const metric of OVERVIEW_METRICS) {
      if (metric.kind !== "jump") continue;
      const values = rows.map((r) => r.readings[metric.key]?.value).filter((v): v is number => v !== undefined);
      // Il "migliore" ha senso solo se c'è da confrontare.
      if (values.length > 1) best[metric.key] = Math.max(...values);
    }
    return best;
  }, [rows]);

  const averages = useMemo(
    () =>
      Object.fromEntries(
        OVERVIEW_METRICS.map((metric) => [
          metric.key,
          mean(rows.map((r) => r.readings[metric.key]?.value).filter((v): v is number => v !== undefined)),
        ]),
      ) as Record<OverviewMetricKey, number | null>,
    [rows],
  );

  const hasOthers = rows.some((r) => r.others.length > 0);
  const testedCount = rows.filter((r) => r.date !== null).length;
  const missingOnDay =
    view === "giorno" ? visibleAthletes.filter((a) => !a.sessions.some((s) => s.date === day)) : [];

  function downloadCsv() {
    const header = [
      "Atleta",
      "Categoria",
      "Data",
      ...OVERVIEW_METRICS.map((m) => `${m.label} (${m.unit})`),
      "Altri dati",
    ];
    const lines = rows.map((r) => [
      r.athlete.fullName,
      r.athlete.label ?? "",
      r.date ?? "",
      ...OVERVIEW_METRICS.map((m) => csvNumber(r.readings[m.key]?.value)),
      r.others.map((o) => `${o.name}: ${o.value}`).join(" | "),
    ]);
    // Il segno d'ordine dei byte fa riconoscere a Excel che il file è in UTF-8 (accenti).
    const blob = new Blob(["﻿" + buildCsv(header, lines)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `test-fisici-${view === "giorno" ? day : view}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-test-riepilogo>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label="Cosa mostrare">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              aria-pressed={view === v}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                view === v ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {view === "giorno" && (
          <Select
            aria-label="Giorno del test"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-10 w-auto min-w-[12rem]"
          >
            {days.map(([date, count]) => (
              <option key={date} value={date}>
                {formatDateShort(date)} · {count} {count === 1 ? "atleta" : "atlete"}
              </option>
            ))}
          </Select>
        )}

        {labels.length > 1 && (
          <Select
            aria-label="Categoria"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-10 w-auto min-w-[9rem]"
          >
            <option value="">Tutte le categorie</option>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        )}

        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome…"
          aria-label="Cerca un'atleta"
          className="sm:max-w-[16rem]"
        />

        <Button type="button" variant="outline" size="sm" onClick={downloadCsv} disabled={rows.length === 0} className="ml-auto">
          <Download className="h-4 w-4" />
          Scarica CSV
        </Button>
      </div>

      {view === "ultimo" && athletes.some((a) => a.sessions.length === 0) && (
        <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-[var(--primary)]"
          />
          Mostra anche chi non ha ancora nessun test
        </label>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun risultato per questa ricerca.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="border-b border-border bg-surface-muted">
              <tr>
                <SortHeader label="Atleta" column="name" sort={sort} onSort={toggleSort} align="left" />
                <SortHeader
                  label={view === "ultimo" ? "Ultimo test" : "Data"}
                  column="date"
                  sort={sort}
                  onSort={toggleSort}
                  align="left"
                />
                {OVERVIEW_METRICS.map((metric) => (
                  <SortHeader
                    key={metric.key}
                    label={metric.label}
                    sublabel={metric.unit}
                    column={metric.key}
                    sort={sort}
                    onSort={toggleSort}
                  />
                ))}
                {hasOthers && (
                  <th scope="col" className="px-3 py-2.5 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Altri dati
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.key} className="transition-colors hover:bg-surface-muted/70" data-riepilogo-row={row.athlete.id}>
                  <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left font-normal">
                    <Link
                      href={`/admin/test-fisici/atleta/${row.athlete.id}`}
                      className="group flex min-w-[10.5rem] items-center gap-2.5"
                    >
                      <Avatar name={row.athlete.fullName} size="sm" tone={row.date ? row.athlete.tone : "neutral"} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground group-hover:text-primary">
                          {row.athlete.fullName}
                        </span>
                        {row.athlete.label && (
                          <span className="block text-[11px] text-muted-foreground">{row.athlete.label}</span>
                        )}
                      </span>
                    </Link>
                  </th>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">
                    {row.date ? (
                      <Link
                        href={`/admin/test-fisici/atleta/${row.athlete.id}/sessione/${row.date}`}
                        className="text-foreground/80 hover:text-primary hover:underline"
                        title="Apri la sessione per correggerla"
                      >
                        {formatDateShort(row.date)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/60">Nessun test</span>
                    )}
                  </td>
                  {OVERVIEW_METRICS.map((metric) => {
                    const reading = row.readings[metric.key];
                    return (
                      <MetricCell
                        key={metric.key}
                        metric={metric}
                        reading={reading}
                        isBest={reading !== undefined && bestByMetric[metric.key] === reading.value}
                        showDate={view === "ultimo"}
                        rowDate={row.date}
                      />
                    );
                  })}
                  {hasOthers && (
                    <td className="max-w-[16rem] px-3 py-2.5 align-top">
                      <span className="flex flex-wrap gap-1">
                        {row.others.map((o, i) => (
                          <span
                            key={`${o.name}_${i}`}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80"
                            title={`${o.name}: ${o.value}`}
                          >
                            <span className="font-semibold">{o.name}</span> {o.value}
                          </span>
                        ))}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border-strong bg-surface-muted">
              <tr>
                <th scope="row" className="sticky left-0 z-10 bg-surface-muted px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Media
                </th>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {testedCount} {testedCount === 1 ? "riga" : "righe"}
                </td>
                {OVERVIEW_METRICS.map((metric) => {
                  const value = averages[metric.key];
                  return (
                    <td key={metric.key} className="tabular px-3 py-2.5 text-right font-semibold text-foreground/80">
                      {value === null ? <span className="font-normal text-muted-foreground/50">—</span> : formatMeasure(value)}
                    </td>
                  );
                })}
                {hasOthers && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {view === "giorno" && missingOnDay.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Senza test in questo giorno ({missingOnDay.length}): {missingOnDay.map((a) => a.fullName).join(", ")}.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        I salti sono la media dei tentativi della sessione. Sotto ogni numero la variazione rispetto alla misura
        precedente della stessa atleta; in verde il valore più alto di ogni salto. Un clic sull&apos;intestazione
        ordina la colonna.
      </p>
    </div>
  );
}
