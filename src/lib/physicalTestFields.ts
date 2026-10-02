import type { PhysicalTest } from "@/lib/types";

/**
 * Campi "noti" dei test fisici: finché il nome di un test è libero (vedi
 * PhysicalTest.testName), qualunque cosa può essere confrontata nel tempo
 * solo raggruppando per nome esatto. Qui fissiamo i nomi canonici dei campi
 * richiesti dallo staff (squat jump + misure corporee), così l'inserimento
 * può mostrare campi dedicati invece di testo libero, e lo storico può
 * raggrupparli in una vista strutturata invece che come righe sparse. Ogni
 * campo resta comunque una normale riga PhysicalTest sotto — nessuna
 * modifica allo schema: solo una convenzione sul testName.
 */

export const SQUAT_JUMP_LABEL = "Squat Jump";
export const SQUAT_JUMP_TRIALS = 3;

export type SquatJumpMetric = "tempo" | "altezza";

const SQUAT_JUMP_METRIC_LABELS: Record<SquatJumpMetric, string> = {
  tempo: "Tempo di volo (s)",
  altezza: "Altezza (cm)",
};

/** Nome canonico di un singolo salto, es. "Squat Jump · Salto 2 · Altezza (cm)". */
export function squatJumpFieldName(trial: number, metric: SquatJumpMetric): string {
  return `${SQUAT_JUMP_LABEL} · Salto ${trial} · ${SQUAT_JUMP_METRIC_LABELS[metric]}`;
}

/** true se il nome appartiene a un campo Squat Jump (qualunque salto/metrica). */
export function isSquatJumpField(testName: string): boolean {
  return testName.startsWith(`${SQUAT_JUMP_LABEL} · `);
}

export interface BodyMeasureField {
  key: "peso" | "gamba90" | "gambaEstesa";
  label: string;
  unit: string;
  testName: string;
}

export const BODY_MEASURE_FIELDS: BodyMeasureField[] = [
  { key: "peso", label: "Peso", unit: "kg", testName: "Peso (kg)" },
  { key: "gamba90", label: "Lunghezza gamba a 90°", unit: "cm", testName: "Lunghezza gamba a 90° (cm)" },
  { key: "gambaEstesa", label: "Lunghezza gamba estesa", unit: "cm", testName: "Lunghezza gamba estesa (cm)" },
];

const BODY_MEASURE_NAMES = new Set(BODY_MEASURE_FIELDS.map((f) => f.testName));

export function isBodyMeasureField(testName: string): boolean {
  return BODY_MEASURE_NAMES.has(testName);
}

/** Un salto raccolto da una singola sessione (stessa data): i due valori
 * sono stringhe numeriche libere (vedi PhysicalTest.value) convertite in
 * numero solo per calcolare la media — se mancante o non numerico resta
 * fuori dal calcolo invece di far fallire l'intera sessione. */
export interface SquatJumpTrial {
  trial: number;
  tempo: string | null;
  altezza: string | null;
}

export interface SquatJumpSession {
  date: string;
  trials: SquatJumpTrial[];
  meanTempo: number | null;
  meanAltezza: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Raggruppa le righe Squat Jump di un'atleta per data (una sessione = tutti
 * i salti fatti lo stesso giorno), calcolando la media di ogni metrica sui
 * soli salti validi di quella sessione — la stessa logica della card
 * "Summary" dell'app di riferimento usata finora dallo staff. */
export function groupSquatJumpSessions(tests: PhysicalTest[]): SquatJumpSession[] {
  const byDate = new Map<string, Map<number, SquatJumpTrial>>();
  for (const test of tests) {
    if (!isSquatJumpField(test.testName)) continue;
    const match = test.testName.match(/Salto (\d+) · (Tempo di volo|Altezza)/);
    if (!match) continue;
    const trial = Number(match[1]);
    const metric: SquatJumpMetric = match[2] === "Tempo di volo" ? "tempo" : "altezza";

    let trials = byDate.get(test.date);
    if (!trials) {
      trials = new Map();
      byDate.set(test.date, trials);
    }
    const existing = trials.get(trial) ?? { trial, tempo: null, altezza: null };
    existing[metric] = test.value;
    trials.set(trial, existing);
  }

  const sessions: SquatJumpSession[] = [...byDate.entries()].map(([date, trialsMap]) => {
    const trials = [...trialsMap.values()].sort((a, b) => a.trial - b.trial);
    const meanTempo = mean(trials.map((t) => Number(t.tempo)).filter((n) => Number.isFinite(n)));
    const meanAltezza = mean(trials.map((t) => Number(t.altezza)).filter((n) => Number.isFinite(n)));
    return { date, trials, meanTempo, meanAltezza };
  });

  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

export interface BodyMeasureHistory extends BodyMeasureField {
  latest: PhysicalTest | null;
  previous: PhysicalTest | null;
}

/** Per ogni misura corporea, l'ultimo valore registrato e il precedente
 * (per il confronto), entrambi opzionali: un'atleta nuova non ha ancora
 * nulla da mostrare. */
export function getBodyMeasureHistory(tests: PhysicalTest[]): BodyMeasureHistory[] {
  return BODY_MEASURE_FIELDS.map((field) => {
    const entries = tests
      .filter((t) => t.testName === field.testName)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { ...field, latest: entries[0] ?? null, previous: entries[1] ?? null };
  });
}
