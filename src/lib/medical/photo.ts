/**
 * La foto del certificato medico: la carica il genitore dal suo link (o lo staff) insieme al giorno della visita, e la vede solo lo
 * staff con il permesso «Certificati medici». Sul telefono viene rimpicciolita prima dell'invio (vedi compressPhoto); qui le regole
 * pure: che file si accettano (riconosciuti dai primi byte, mai dal nome o da quello che dice il browser), quanto possono pesare e
 * quando la foto di prima resta. I byte stanno a parte (Storage privato di Supabase, o in memoria): nel certificato solo questi dati.
 */

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

export interface CertificatePhoto {
  contentType: PhotoType;
  /** Byte, per dire quanto pesa. */
  size: number;
  uploadedAt: string;
  /** Chi l'ha caricata: il genitore dal suo link, o qualcuno dello staff (`updatedBy`, l'id del suo account). */
  by: "parent" | "staff";
  updatedBy: string | null;
}

/** Dove stanno su Supabase: un contenitore privato, creato dal sito alla prima foto. */
export const PHOTO_BUCKET = "medical-certificates";

/** Una foto già rimpicciolita pesa qualche centinaio di KB: oltre i 2,5 MB qualcosa non va (o il telefono non l'ha rimpicciolita). */
export const PHOTO_MAX_BYTES = 2_500_000;

export const PHOTO_TYPES: readonly PhotoType[] = ["image/jpeg", "image/png", "image/webp"];

/** Il tipo vero dell'immagine, dai primi byte (JPEG, PNG o WebP); null per tutto il resto. */
export function sniffImageType(bytes: Uint8Array): PhotoType | null {
  const at = (index: number, values: number[]) => values.every((value, offset) => bytes[index + offset] === value);
  if (bytes.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytes.length >= 12 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  return null;
}

export type PhotoCheck = { ok: true; contentType: PhotoType } | { ok: false; error: string };

/** Il file arrivato al server: una foto vera e non troppo pesante. Ogni errore dice cosa fare. */
export function checkPhoto(bytes: Uint8Array): PhotoCheck {
  if (bytes.length === 0) return { ok: false, error: "La foto è vuota: scegline un'altra." };
  if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, error: "La foto è troppo pesante: scegline un'altra o fai uno screenshot del certificato." };
  const contentType = sniffImageType(bytes);
  if (!contentType) return { ok: false, error: "Questo file non è una foto: scegli una foto del certificato (JPEG, PNG o WebP)." };
  return { ok: true, contentType };
}

/**
 * Se la visita resta la stessa la foto di prima resta; con una visita nuova no (era del certificato vecchio): va caricata quella
 * del nuovo.
 */
export function keepPhoto(previous: { issuedOn: string; photo: CertificatePhoto | null } | null, issuedOn: string): CertificatePhoto | null {
  return previous && previous.issuedOn === issuedOn ? previous.photo : null;
}

export function parsePhoto(raw: unknown): CertificatePhoto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (!PHOTO_TYPES.includes(record.contentType as PhotoType)) return null;
  if (typeof record.uploadedAt !== "string" || !record.uploadedAt) return null;
  return {
    contentType: record.contentType as PhotoType,
    size: typeof record.size === "number" && Number.isFinite(record.size) && record.size > 0 ? Math.round(record.size) : 0,
    uploadedAt: record.uploadedAt,
    by: record.by === "staff" ? "staff" : "parent",
    updatedBy: typeof record.updatedBy === "string" && record.updatedBy ? record.updatedBy : null,
  };
}

/** «340 KB», «1,2 MB». */
export function sizeLabel(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`;
}
