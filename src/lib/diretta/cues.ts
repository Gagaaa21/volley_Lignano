import { z } from "zod";

/**
 * La pulsantiera della diretta (un tablet in palestra, come uno Stream Deck): un tocco e nella grafica del video parte una
 * scritta animata con il suo jingle, «MONSTER BLOCK», «ACE»… Solo la scritta, mai la giocatrice: nella diretta non escono mai
 * azioni o statistiche di una singola atleta (ordine del proprietario, vedi CLAUDE.md).
 *
 * Dove sta: in app_settings, chiave LIVE_CUES_KEY, l'ultima scritta mandata (id, tipo, quando) e le versioni dei suoni caricati
 * dallo staff. Il punteggio pubblico la legge nella stessa query della copia dello Scout (vedi /api/livescore/pubblico): la
 * grafica di Streamlabs / OBS la rilegge già ogni secondo, quindi la pulsantiera non aggiunge nessuna lettura al database. I
 * file audio caricati stanno in chiavi a parte (cueSoundKey) e si scaricano una volta sola per versione
 * (/api/diretta/suono/[tipo]?v=…), mai a ogni lettura.
 */

export const LIVE_CUES_KEY = "live_cues";

export const CUE_KINDS = ["monsterBlock", "ace", "attack", "dig", "rally", "cheer"] as const;
export type CueKind = (typeof CUE_KINDS)[number];

export interface CueMeta {
  /** Il nome del tasto sul tablet. */
  button: string;
  /** La riga piccola sopra la scritta grande (può mancare). */
  kicker: string | null;
  /** La scritta grande nel video. */
  title: string;
  /** Una riga che spiega quando usarlo (sul tablet). */
  hint: string;
}

export const CUE_META: Record<CueKind, CueMeta> = {
  monsterBlock: { button: "Monster block", kicker: "MONSTER", title: "BLOCK", hint: "Un muro che fa punto, di quelli che si ricordano" },
  ace: { button: "Ace", kicker: "PUNTO IN BATTUTA", title: "ACE!", hint: "Battuta vincente" },
  attack: { button: "Super attacco", kicker: "CHE COLPO", title: "SUPER ATTACCO", hint: "Un attacco imprendibile" },
  dig: { button: "Difesa spettacolare", kicker: "CHE DIFESA", title: "SALVATAGGIO!", hint: "Una palla recuperata quando sembrava persa" },
  rally: { button: "Che scambio!", kicker: "APPLAUSI", title: "CHE SCAMBIO!", hint: "Uno scambio lungo e combattuto" },
  cheer: { button: "Forza Lignano", kicker: "TUTTI INSIEME", title: "FORZA LIGNANO!", hint: "Per il tifo, quando serve una spinta" },
};

/** Quanto resta in onda una scritta (animazione di entrata e di uscita comprese): quanto il suono del Monster block, 4,75 s. */
export const CUE_DURATION_MS = 5_000;
/**
 * Una scritta più vecchia di così non parte più: chi apre (o ricarica) la grafica dopo non vede ripartire quella di prima. Con
 * il ritardo della pagina /diretta la scritta si mostra comunque dopo i secondi del ritardo (vedi GraficaClient).
 */
export const CUE_FRESH_MS = 15_000;
/** Il tablet non manda due scritte una sopra l'altra: tra un tocco e l'altro (anche di tasti diversi) almeno questo. */
export const CUE_COOLDOWN_MS = 1_500;

/** I file audio caricati dallo staff: pochi secondi di jingle, al massimo questo. */
export const MAX_SOUND_BYTES = 400_000;
export const SOUND_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"] as const;

export const cueSoundKey = (kind: CueKind) => `live_cue_sound:${kind}`;

const kindSchema = z.enum(CUE_KINDS);

const storedSchema = z.object({
  last: z.object({ id: z.string().min(1).max(64), kind: kindSchema, at: z.number().int().min(0) }).nullable(),
  /** Per ogni tasto con un suono caricato, la sua versione (l'istante del caricamento): cambia l'indirizzo, quindi la cache. */
  sounds: z.record(z.string(), z.number().int().min(0)),
});

export type StoredCues = z.infer<typeof storedSchema>;

export const EMPTY_CUES: StoredCues = { last: null, sounds: {} };

export function isCueKind(value: unknown): value is CueKind {
  return typeof value === "string" && (CUE_KINDS as readonly string[]).includes(value);
}

/** Quello che è salvato, o vuoto se manca o non si legge (un valore rovinato non ferma mai il punteggio). */
export function parseCues(raw: string | null | undefined): StoredCues {
  if (!raw) return EMPTY_CUES;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return EMPTY_CUES;
    // Solo i tasti che esistono: un suono di un tasto tolto non si propone più.
    const sounds = Object.fromEntries(Object.entries(parsed.data.sounds).filter(([kind]) => isCueKind(kind)));
    return { last: parsed.data.last, sounds };
  } catch {
    return EMPTY_CUES;
  }
}

export function withCue(stored: StoredCues, kind: CueKind, id: string, at: number): StoredCues {
  return { ...stored, last: { id, kind, at } };
}

export function withSound(stored: StoredCues, kind: CueKind, version: number | null): StoredCues {
  const sounds = { ...stored.sounds };
  if (version === null) delete sounds[kind];
  else sounds[kind] = version;
  return { ...stored, sounds };
}

/** La versione del suono caricato per quel tasto, o null se si usa quello di partenza (o nessuno). */
export function soundVersion(stored: StoredCues, kind: CueKind): number | null {
  return stored.sounds[kind] ?? null;
}

/**
 * Quello che va al pubblico: la scritta solo se è fresca, con i secondi che ha (`age`, in ms: con il ritardo della pagina
 * /diretta si mostra quando il video arriva a quel punto) e la versione del suono caricato. Solo il tipo: nessuna giocatrice.
 */
export interface PublicCue {
  id: string;
  kind: CueKind;
  age: number;
  sound: number | null;
}

export function publicCueFrom(raw: string | null | undefined, now: number): PublicCue | null {
  const stored = parseCues(raw);
  const last = stored.last;
  if (!last) return null;
  const age = Math.max(0, now - last.at);
  if (age > CUE_FRESH_MS) return null;
  return { id: last.id, kind: last.kind, age, sound: soundVersion(stored, last.kind) };
}

/** I suoni caricati (tasto → versione), per prepararli prima del tocco: pochi byte, vanno con ogni lettura. */
export function publicCueSounds(raw: string | null | undefined): Partial<Record<CueKind, number>> {
  return parseCues(raw).sounds as Partial<Record<CueKind, number>>;
}

/** L'indirizzo del suono caricato per un tasto (con la versione: la rete lo tiene per sempre). */
export function soundUrl(kind: CueKind, version: number): string {
  return `/api/diretta/suono/${kind}?v=${version}`;
}

/**
 * I tasti con un suono di partenza: solo il Monster block, con lo speaker da arena americana che urla «MOOONSTEEEER
 * BLOOOOOCK!» sopra una musica aggressiva fatta apposta (scelta del proprietario: gli altri tasti sono solo animazione, senza suono). Tutto
 * originale e libero (voce sintetica fatta con un modello MIT, musica sintetizzata, vedi README): niente problemi su YouTube. File statico in
 * public/diretta/suoni, pochi kB; quando si rifà si alza DEFAULT_SOUNDS_VERSION, così la rete (che lo tiene per un anno)
 * scarica quello nuovo. Lo staff può comunque caricare un file suo su qualsiasi tasto (soundUrl).
 */
export const DEFAULT_SOUND_KINDS: readonly CueKind[] = ["monsterBlock"];
export const DEFAULT_SOUNDS_VERSION = 7;

/** L'indirizzo del suono di partenza di un tasto, o null se il tasto è solo animazione. */
export function defaultSoundUrl(kind: CueKind): string | null {
  return DEFAULT_SOUND_KINDS.includes(kind) ? `/diretta/suoni/${kind}.mp3?v=${DEFAULT_SOUNDS_VERSION}` : null;
}

/** Il file caricato com'è salvato: tipo e contenuto in base64 (pochi kB, in una chiave a parte che si legge solo per scaricarlo). */
const soundFileSchema = z.object({ type: z.enum(SOUND_TYPES), data: z.string().min(1) });
export type StoredSound = z.infer<typeof soundFileSchema>;

export function parseSound(raw: string | null | undefined): StoredSound | null {
  if (!raw) return null;
  try {
    const parsed = soundFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Il tipo del file come lo dichiara il browser, normalizzato (alcuni dicono «audio/mp3», altri niente: si guarda l'estensione). */
export function soundTypeOf(file: { type: string; name: string }): StoredSound["type"] | null {
  const declared = file.type.toLowerCase();
  if ((SOUND_TYPES as readonly string[]).includes(declared)) return declared === "audio/mp3" ? "audio/mpeg" : (declared as StoredSound["type"]);
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, StoredSound["type"]> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav", webm: "audio/webm" };
  return byExt[ext] ?? null;
}
