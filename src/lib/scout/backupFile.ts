import { scoutDataSchema } from "./schema";
import { scoutContent } from "./sync";
import type { ScoutData } from "./types";

/**
 * La copia dello scout come file (si scarica con «Scarica una copia» e si rimette con «Ripristina da file»): serve quando
 * qualcosa non si salva e non si vuole rischiare di perdere i punti, o per spostare uno scout da un dispositivo all'altro.
 * Regole pure: il browser fa solo scaricare e scegliere il file.
 */

const APP = "volley-lignano-scout";

export interface ScoutExport {
  app: typeof APP;
  version: 1;
  matchId: string;
  exportedAt: string;
  data: ScoutData;
}

export function buildExport(matchId: string, data: ScoutData, now: Date): ScoutExport {
  return { app: APP, version: 1, matchId, exportedAt: now.toISOString(), data: scoutContent(data) };
}

/** Un nome di file semplice: «scout-vs-degano-2026-10-17-1830.json». */
export function exportFileName(title: string, now: Date): string {
  const slug =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "partita";
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `scout-${slug}-${stamp}.json`;
}

export type ImportResult = { ok: true; data: ScoutData; matchId: string | null } | { ok: false; error: string };

/** Legge un file scaricato da qui (o un semplice scout): se non è uno scout valido dice perché. */
export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Il file non è una copia dello Scout (non si legge)." };
  }
  const envelope = parsed && typeof parsed === "object" ? (parsed as Partial<ScoutExport>) : null;
  const wrapped = envelope?.app === APP && envelope.data !== undefined;
  const candidate = wrapped ? envelope.data : parsed;
  const result = scoutDataSchema.safeParse(candidate);
  if (!result.success) return { ok: false, error: "Il file non è una copia dello Scout (i dati non tornano)." };
  const matchId = wrapped && typeof envelope.matchId === "string" ? envelope.matchId : null;
  return { ok: true, data: scoutContent(result.data), matchId };
}
