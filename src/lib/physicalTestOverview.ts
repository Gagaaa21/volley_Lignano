import type { PhysicalTest } from "@/lib/types";
import {
  BODY_MEASURE_FIELDS,
  groupSquatJumpSessions,
  isBodyMeasureField,
  isSquatJumpField,
  parseMeasure,
} from "@/lib/physicalTestFields";

/**
 * Dati dei test fisici in forma di tabella: una riga per atleta (o per atleta
 * e giorno), una colonna per ogni misura. Le righe PhysicalTest restano quelle
 * di sempre (nome del test + valore libero): qui si leggono solo i numeri dei
 * campi noti — misure corporee e media dei salti Squat Jump — e tutto il resto
 * viene tenuto da parte come "altri dati".
 */

export type OverviewMetricKey = "peso" | "gamba90" | "gambaEstesa" | "sjAltezza" | "sjTempo" | "sjForza";

export interface OverviewMetric {
  key: OverviewMetricKey;
  label: string;
  unit: string;
  /** I salti hanno un "meglio" (più alto = meglio): servono a evidenziare i migliori e a colorare le variazioni. */
  kind: "body" | "jump";
}

export const OVERVIEW_METRICS: OverviewMetric[] = [
  ...BODY_MEASURE_FIELDS.map((f): OverviewMetric => ({ key: f.key, label: f.label, unit: f.unit, kind: "body" })),
  { key: "sjAltezza", label: "Salto · altezza", unit: "cm", kind: "jump" },
  { key: "sjTempo", label: "Salto · tempo di volo", unit: "ms", kind: "jump" },
  { key: "sjForza", label: "Salto · forza", unit: "N", kind: "jump" },
];

/** Cosa è stato misurato a un'atleta in un singolo giorno. */
export interface AthleteSession {
  date: string; // "YYYY-MM-DD"
  /** Solo i valori numerici: un dato scritto a parole non entra nei confronti. */
  values: Partial<Record<OverviewMetricKey, number>>;
  /** Righe libere (e campi noti non numerici), nell'ordine di inserimento. */
  others: { name: string; value: string }[];
}

const BODY_KEY_BY_NAME = new Map(BODY_MEASURE_FIELDS.map((f) => [f.testName, f.key] as const));

/** Le sessioni di un'atleta (una per giorno con almeno un dato), dalla più recente. */
export function buildAthleteSessions(athleteTests: PhysicalTest[]): AthleteSession[] {
  const byDate = new Map<string, AthleteSession>();
  const sessionOf = (date: string) => {
    let session = byDate.get(date);
    if (!session) {
      session = { date, values: {}, others: [] };
      byDate.set(date, session);
    }
    return session;
  };

  const ordered = [...athleteTests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const test of ordered) {
    const session = sessionOf(test.date);
    if (isSquatJumpField(test.testName)) continue; // le medie dei salti si calcolano sotto
    const bodyKey = BODY_KEY_BY_NAME.get(test.testName);
    if (bodyKey && isBodyMeasureField(test.testName)) {
      const n = parseMeasure(test.value);
      if (n !== null) session.values[bodyKey] = n;
      else session.others.push({ name: test.testName, value: test.value });
      continue;
    }
    session.others.push({ name: test.testName, value: test.value });
  }

  for (const jump of groupSquatJumpSessions(athleteTests)) {
    const session = sessionOf(jump.date);
    if (jump.meanAltezza !== null) session.values.sjAltezza = jump.meanAltezza;
    if (jump.meanTempo !== null) session.values.sjTempo = jump.meanTempo;
    if (jump.meanForza !== null) session.values.sjForza = jump.meanForza;
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Un valore con il giorno in cui è stato misurato e quello precedente (per la variazione). */
export interface MetricReading {
  value: number;
  date: string;
  previous: number | null;
}

/**
 * Il valore di una misura nella sessione `sessions[index]`, con il valore
 * precedente (la sessione più vecchia in cui la stessa misura c'è). `sessions`
 * va dalla più recente alla più vecchia.
 */
export function readingAt(
  sessions: AthleteSession[],
  index: number,
  key: OverviewMetricKey,
): MetricReading | null {
  const value = sessions[index]?.values[key];
  if (value === undefined) return null;
  let previous: number | null = null;
  for (let i = index + 1; i < sessions.length; i++) {
    const earlier = sessions[i].values[key];
    if (earlier !== undefined) {
      previous = earlier;
      break;
    }
  }
  return { value, date: sessions[index].date, previous };
}

/** L'ultimo valore registrato di una misura, anche se le misure sono state prese in giorni diversi. */
export function latestReading(sessions: AthleteSession[], key: OverviewMetricKey): MetricReading | null {
  const index = sessions.findIndex((s) => s.values[key] !== undefined);
  return index === -1 ? null : readingAt(sessions, index, key);
}

/** Numero come lo si legge: al massimo un decimale, virgola italiana. */
export function formatMeasure(value: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value);
}

/** Variazione con segno ("+1,2", "−0,5"); null se non c'è stata (meno di mezzo decimale). */
export function formatDelta(current: number, previous: number): string | null {
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return null;
  return `${diff > 0 ? "+" : "−"}${formatMeasure(Math.abs(diff))}`;
}
