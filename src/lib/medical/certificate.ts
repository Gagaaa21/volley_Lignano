import { addYears, differenceInCalendarDays, format, parseISO, subMonths, subYears } from "date-fns";
import { it } from "date-fns/locale";
import { parsePhoto, type CertificatePhoto } from "./photo";

/**
 * Il certificato medico di ogni atleta (solo U14/U15): non si carica il documento, si scrive solo il giorno della visita. Lo scrive
 * il genitore dal suo link personale (lo stesso delle assenze) oppure lo staff. Il certificato dura sempre un anno: la scadenza la
 * calcola il sito. Il sito dice anche se è valido: un mese prima della scadenza diventa rosso, così lo staff avvisa il genitore in
 * tempo. Funzioni pure, con le loro prove; le date sono «AAAA-MM-GG» e si confrontano come testo.
 */

export interface MedicalCertificate {
  athleteId: string;
  /** Il giorno della visita. */
  issuedOn: string;
  /** L'ultimo giorno in cui vale (compreso): sempre un anno dopo la visita, mai scritto a mano (vedi expiryFor). */
  validUntil: string;
  /** Chi l'ha scritto l'ultima volta: il genitore dal suo link, o qualcuno dello staff (`updatedBy`, l'id del suo account). */
  by: "parent" | "staff";
  updatedBy: string | null;
  updatedAt: string;
  /** La foto del certificato, se c'è (i suoi byte stanno a parte: vedi photo.ts). */
  photo: CertificatePhoto | null;
}

/** Dove stanno, tra le impostazioni del sito (tabella app_settings): una chiave per atleta, nessuna tabella in più. */
export const CERTIFICATE_PREFIX = "medical_certificate:";
export const certificateKey = (athleteId: string) => `${CERTIFICATE_PREFIX}${athleteId}`;

/** Quanto dura un certificato: sempre un anno dalla visita. */
export const CERTIFICATE_VALIDITY_YEARS = 1;
/** Una visita di più di due anni fa è quasi sicuramente un errore di battitura (l'anno sbagliato). */
export const MAX_VISIT_AGE_YEARS = 2;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** «AAAA-MM-GG» di un giorno vero (niente 31 febbraio). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  return real.getUTCFullYear() === y && real.getUTCMonth() === m - 1 && real.getUTCDate() === d;
}

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/** Da quando diventa rosso: un mese prima della scadenza (scadenza il 31 marzo → dal 28 febbraio). */
export function warningFrom(validUntil: string): string {
  return iso(subMonths(parseISO(validUntil), 1));
}

/** Fino a quando vale: lo stesso giorno, un anno dopo la visita (visita il 29 febbraio → 28 febbraio). */
export function expiryFor(issuedOn: string): string {
  return iso(addYears(parseISO(issuedOn), CERTIFICATE_VALIDITY_YEARS));
}

/**
 * Per la barra della validità: dove si è oggi tra la visita (0) e la scadenza (1), fermandosi ai bordi, e da dove la barra diventa
 * rossa (un mese prima della scadenza).
 */
export function validityTimeline(certificate: Pick<MedicalCertificate, "issuedOn" | "validUntil">, today: string): { today: number; warning: number } {
  const start = parseISO(certificate.issuedOn);
  const total = Math.max(1, differenceInCalendarDays(parseISO(certificate.validUntil), start));
  const at = (date: string) => Math.min(1, Math.max(0, differenceInCalendarDays(parseISO(date), start) / total));
  return { today: at(today), warning: at(warningFrom(certificate.validUntil)) };
}

export type CertificateStatus =
  /** Nessuna visita scritta: non si sa, quindi non è valido. */
  | { kind: "missing" }
  /** Valido e lontano dalla scadenza. */
  | { kind: "valid"; validUntil: string; daysLeft: number }
  /** Ancora valido, ma scade entro un mese: rosso. */
  | { kind: "expiring"; validUntil: string; daysLeft: number }
  /** Scaduto: non valido. */
  | { kind: "expired"; validUntil: string; daysAgo: number };

export function certificateStatus(certificate: Pick<MedicalCertificate, "validUntil"> | null | undefined, today: string): CertificateStatus {
  if (!certificate) return { kind: "missing" };
  const daysLeft = differenceInCalendarDays(parseISO(certificate.validUntil), parseISO(today));
  if (daysLeft < 0) return { kind: "expired", validUntil: certificate.validUntil, daysAgo: -daysLeft };
  if (today >= warningFrom(certificate.validUntil)) return { kind: "expiring", validUntil: certificate.validUntil, daysLeft };
  return { kind: "valid", validUntil: certificate.validUntil, daysLeft };
}

/** Valido o no: «in scadenza» è ancora valido (rosso perché va rinnovato presto). */
export function isCertificateValid(status: CertificateStatus): boolean {
  return status.kind === "valid" || status.kind === "expiring";
}

/** Da sistemare: tutto tranne «valido» (scaduto e in scadenza in rosso; senza data, da chiedere al genitore). */
export function needsAttention(status: CertificateStatus): boolean {
  return status.kind !== "valid";
}

/** «12 marzo 2027» */
export function dayLabel(date: string): string {
  return format(parseISO(date), "d MMMM yyyy", { locale: it });
}

/** «12 mar 2027», sotto la barra della validità. */
export function shortDay(date: string): string {
  return format(parseISO(date), "d MMM yyyy", { locale: it });
}

const inDays = (days: number) => (days === 0 ? "oggi" : days === 1 ? "domani" : `tra ${days} giorni`);

export interface StatusLabel {
  /** In breve, sulla pastiglia: «Valido», «Scade tra 16 giorni», «Scaduto», «Da inserire». */
  badge: string;
  tone: "success" | "danger" | "warning";
  /** Per esteso: «Valido fino al 12 marzo 2027», «Non valido: scaduto il 3 ottobre 2026»… */
  detail: string;
}

export function statusLabel(status: CertificateStatus): StatusLabel {
  switch (status.kind) {
    case "missing":
      return { badge: "Da inserire", tone: "warning", detail: "Non valido: manca il giorno della visita." };
    case "valid":
      return { badge: "Valido", tone: "success", detail: `Valido fino al ${dayLabel(status.validUntil)}.` };
    case "expiring":
      return {
        badge: status.daysLeft === 0 ? "Scade oggi" : `Scade ${inDays(status.daysLeft)}`,
        tone: "danger",
        detail: `Valido fino al ${dayLabel(status.validUntil)}: scade ${inDays(status.daysLeft)}, va rinnovato.`,
      };
    case "expired":
      return { badge: "Scaduto", tone: "danger", detail: `Non valido: scaduto il ${dayLabel(status.validUntil)}.` };
  }
}

/** Prima chi è già scaduto, poi chi scade (dal più vicino), poi chi non ha la data, infine chi è in regola (dalla scadenza più vicina). */
export function urgencyRank(status: CertificateStatus): [number, number] {
  switch (status.kind) {
    case "expired":
      return [0, -status.daysAgo];
    case "expiring":
      return [1, status.daysLeft];
    case "missing":
      return [2, 0];
    case "valid":
      return [3, status.daysLeft];
  }
}

export function compareUrgency(a: CertificateStatus, b: CertificateStatus): number {
  const [ra, sa] = urgencyRank(a);
  const [rb, sb] = urgencyRank(b);
  return ra - rb || sa - sb;
}

/** Cosa risponde chi salva la data (staff o genitore): l'errore è già scritto per chi lo legge. */
export type CertificateSaveResult = { ok: true } | { ok: false; error: string };

export type CertificateInput = { ok: true; issuedOn: string; validUntil: string } | { ok: false; error: string };

/**
 * Il giorno della visita come lo sceglie il genitore (o lo staff): un giorno vero, non nel futuro e non di più di due anni fa. La
 * scadenza viene da sé, un anno dopo. Ogni errore dice cosa correggere.
 */
export function certificateFromInput(issuedOn: unknown, today: string): CertificateInput {
  const issued = typeof issuedOn === "string" ? issuedOn.trim() : "";
  if (!isIsoDate(issued)) return { ok: false, error: "Scegli il giorno in cui è stata fatta la visita." };
  if (issued > today) return { ok: false, error: "La visita non può essere in un giorno che deve ancora venire." };
  if (issued < iso(subYears(parseISO(today), MAX_VISIT_AGE_YEARS))) {
    return { ok: false, error: "Controlla l'anno: la visita risulta di più di due anni fa." };
  }
  return { ok: true, issuedOn: issued, validUntil: expiryFor(issued) };
}

export function parseCertificate(athleteId: string, raw: string | null | undefined): MedicalCertificate | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isIsoDate(record.issuedOn)) return null;
  return {
    athleteId,
    issuedOn: record.issuedOn,
    // Sempre ricalcolata dalla visita: il certificato dura un anno, qualunque cosa sia stata salvata.
    validUntil: expiryFor(record.issuedOn),
    by: record.by === "staff" ? "staff" : "parent",
    updatedBy: typeof record.updatedBy === "string" && record.updatedBy ? record.updatedBy : null,
    updatedAt: typeof record.updatedAt === "string" && record.updatedAt ? record.updatedAt : new Date(0).toISOString(),
    photo: parsePhoto(record.photo),
  };
}

/** La visita, chi l'ha scritta e la foto (solo i suoi dati): la scadenza si ricalcola a ogni lettura. */
export function serializeCertificate(certificate: MedicalCertificate): string {
  const { issuedOn, by, updatedBy, updatedAt, photo } = certificate;
  return JSON.stringify({ issuedOn, by, updatedBy, updatedAt, photo });
}

/**
 * Il messaggio da mandare al genitore quando il certificato scade, è scaduto, manca la data o (in regola) manca la foto: che cosa
 * succede e, se c'è, il link personale da cui scrivere il giorno della visita e caricare la foto. Null se è tutto a posto.
 */
export function parentReminder(athleteName: string, status: CertificateStatus, link: string | null, hasPhoto = true): string | null {
  const first = athleteName.trim().split(/\s+/)[0] ?? athleteName;
  let what: string;
  switch (status.kind) {
    case "valid":
      if (hasPhoto) return null;
      return [
        `Ciao! Per il certificato medico di ${first} ci manca la foto.`,
        link ? `Potete caricarla qui (basta una foto leggibile del certificato): ${link}` : "Quando potete, mandateci una foto del certificato.",
      ].join("\n");
    case "missing":
      what = `ci manca la data del certificato medico di ${first}.`;
      break;
    case "expiring":
      what = `il certificato medico di ${first} scade ${status.daysLeft === 0 ? "oggi" : `il ${dayLabel(status.validUntil)}`}: va rinnovato.`;
      break;
    case "expired":
      what = `il certificato medico di ${first} è scaduto il ${dayLabel(status.validUntil)}: va rinnovato al più presto.`;
      break;
  }
  return [
    `Ciao! ${what.charAt(0).toUpperCase()}${what.slice(1)}`,
    link
      ? `Quando avete fatto la visita, scegliete qui il giorno e caricate una foto del certificato (la scadenza la calcola il sito): ${link}`
      : "Quando avete fatto la visita, diteci il giorno e mandateci una foto del certificato.",
  ].join("\n");
}
