import { z } from "zod";

/**
 * La diretta video: ogni telefono su cavalletto fa una diretta su YouTube e lo staff ne incolla i link (fino a 3, uno per
 * camera). I genitori guardano dalla pagina /diretta, che incorpora il video e ci disegna sopra il punteggio dello Scout.
 * Le impostazioni stanno in `app_settings` (chiave `live_stream`, JSON): poche decine di byte.
 */
export const LIVE_STREAM_KEY = "live_stream";
export const MAX_CAMERAS = 3;
/** Dopo questo tempo i link salvati non si mostrano più: una partita non dura così a lungo. */
export const STREAM_TTL_MS = 12 * 60 * 60 * 1000;
/** YouTube mostra il video con 10–20 secondi di ritardo: il punteggio si ritarda di tanto, di partenza. */
export const DEFAULT_DELAY_SECONDS = 15;
export const MAX_DELAY_SECONDS = 60;
export const MAX_CAMERA_NAME = 24;

export interface Camera {
  name: string;
  /** Identificativo del video YouTube (11 caratteri). */
  id: string;
}

export interface StreamSettings {
  cameras: Camera[];
  delaySeconds: number;
  /** Quando lo staff ha salvato i link (ISO). */
  savedAt: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * L'identificativo di un video YouTube da un link (youtu.be/…, watch?v=…, live/…, embed/…, shorts/…) o dall'identificativo
 * stesso; null se non lo si riconosce. Solo identificativi di 11 caratteri: finiscono nell'indirizzo del lettore.
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (YOUTUBE_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["live", "embed", "shorts", "v"].includes(parts[0])) id = parts[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

const settingsSchema = z.object({
  cameras: z.array(z.object({ name: z.string().trim().min(1).max(MAX_CAMERA_NAME), id: z.string().regex(YOUTUBE_ID) })).max(MAX_CAMERAS),
  delaySeconds: z.number().int().min(0).max(MAX_DELAY_SECONDS),
  savedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Data non valida."),
}) satisfies z.ZodType<StreamSettings>;

/** Le impostazioni salvate, o null se mancano, non si leggono, non hanno camere o sono più vecchie di STREAM_TTL_MS. */
export function parseStreamSettings(raw: string | null, now = Date.now()): StreamSettings | null {
  if (!raw) return null;
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.cameras.length === 0) return null;
    return now - Date.parse(parsed.data.savedAt) > STREAM_TTL_MS ? null : parsed.data;
  } catch {
    return null;
  }
}

export interface CameraField {
  name: string;
  link: string;
}

export type BuiltSettings = { ok: true; settings: StreamSettings } | { ok: false; error: string };

/**
 * Le impostazioni dai campi della scheda dell'area riservata: una riga per camera (le righe senza link si saltano), il nome
 * di partenza è «Camera 1…», il ritardo vuoto vale quello di partenza. Un link che non è di YouTube si rifiuta dicendo quale.
 */
export function buildStreamSettings(fields: CameraField[], delay: string, now = Date.now()): BuiltSettings {
  const cameras: Camera[] = [];
  for (const [index, field] of fields.slice(0, MAX_CAMERAS).entries()) {
    const link = field.link.trim();
    if (!link) continue;
    const id = parseYouTubeId(link);
    if (!id) return { ok: false, error: `Il link della camera ${index + 1} non è un link di YouTube: incolla quello della diretta (youtube.com/watch?v=…, youtube.com/live/… o youtu.be/…).` };
    cameras.push({ name: field.name.trim().slice(0, MAX_CAMERA_NAME) || `Camera ${index + 1}`, id });
  }
  if (cameras.length === 0) return { ok: false, error: "Incolla almeno un link di una diretta YouTube." };

  const text = delay.trim();
  const seconds = text === "" ? DEFAULT_DELAY_SECONDS : Number(text.replace(",", "."));
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_DELAY_SECONDS) {
    return { ok: false, error: `Il ritardo del punteggio va da 0 a ${MAX_DELAY_SECONDS} secondi.` };
  }
  return { ok: true, settings: { cameras, delaySeconds: Math.round(seconds), savedAt: new Date(now).toISOString() } };
}

/** L'indirizzo del lettore YouTube da incorporare: senza il pulsante «schermo intero» di YouTube, che lascerebbe fuori il punteggio. */
export function embedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&fs=0&modestbranding=1`;
}
