import { addYears, differenceInCalendarDays, format, parseISO, subMonths } from "date-fns";
import { it } from "date-fns/locale";

/**
 * Il certificato medico di ogni atleta (solo U14/U15): non si carica il documento, si scrivono due date, quando è stata fatta la
 * visita e fino a quando vale. Le scrive il genitore dal suo link personale (lo stesso delle assenze) oppure lo staff. Il sito dice
 * se è valido: un mese prima della scadenza diventa rosso, così lo staff avvisa il genitore in tempo. Funzioni pure, con le loro
 * prove; le date sono «AAAA-MM-GG» e si confrontano come testo.
 */

export interface MedicalCertificate {
  athleteId: string;
  /** Il giorno della visita. */
  issuedOn: string;
  /** L'ultimo giorno in cui vale (compreso). */
  validUntil: string;
  /** Chi l'ha scritto l'ultima volta: il genitore dal suo link, o qualcuno dello staff (`updatedBy`, l'id del suo account). */
  by: "parent" | "staff";
  updatedBy: string | null;
  updatedAt: string;
}

/** Dove stanno, tra le impostazioni del sito (tabella app_settings): una chiave per atleta, nessuna tabella in più. */
export const CERTIFICATE_PREFIX = "medical_certificate:";
export const certificateKey = (athleteId: string) => `${CERTIFICATE_PREFIX}${athleteId}`;

/** Un certificato vale di solito un anno: oltre due anni dalla visita è quasi sicuramente un errore di battitura. */
export const MAX_VALIDITY_YEARS = 2;

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

/** Lo stesso giorno, un anno dopo: la scadenza più comune, da proporre accanto al giorno della visita. */
export function oneYearAfter(issuedOn: string): string {
  return iso(addYears(parseISO(issuedOn), 1));
}

export type CertificateStatus =
  /** Nessuna data: non si sa, quindi non è valido. */
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

/** Da sistemare: tutto tranne «valido» (scaduto e in scadenza in rosso; senza date, da chiedere al genitore). */
export function needsAttention(status: CertificateStatus): boolean {
  return status.kind !== "valid";
}

/** «12 marzo 2027» */
export function dayLabel(date: string): string {
  return format(parseISO(date), "d MMMM yyyy", { locale: it });
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
      return { badge: "Da inserire", tone: "warning", detail: "Non valido: mancano le date del certificato." };
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

/** Prima chi è già scaduto, poi chi scade (dal più vicino), poi chi non ha le date, infine chi è in regola (dalla scadenza più vicina). */
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

/** Cosa risponde chi salva le date (staff o genitore): l'errore è già scritto per chi lo legge. */
export type CertificateSaveResult = { ok: true } | { ok: false; error: string };

export type CertificateInput = { ok: true; issuedOn: string; validUntil: string } | { ok: false; error: string };

/**
 * Le due date come le scrive il genitore (o lo staff): giorni veri, la visita non nel futuro, la scadenza dopo la visita e non più
 * di due anni dopo. Ogni errore dice cosa correggere.
 */
export function certificateFromInput(issuedOn: unknown, validUntil: unknown, today: string): CertificateInput {
  const issued = typeof issuedOn === "string" ? issuedOn.trim() : "";
  const until = typeof validUntil === "string" ? validUntil.trim() : "";
  if (!isIsoDate(issued)) return { ok: false, error: "Scegli il giorno in cui è stata fatta la visita." };
  if (!isIsoDate(until)) return { ok: false, error: "Scegli fino a quando vale il certificato." };
  if (issued > today) return { ok: false, error: "La visita non può essere in un giorno che deve ancora venire." };
  if (until <= issued) return { ok: false, error: "Il certificato deve valere fino a un giorno dopo la visita." };
  if (until > iso(addYears(parseISO(issued), MAX_VALIDITY_YEARS))) {
    return { ok: false, error: "Controlla la scadenza: un certificato vale di solito un anno dalla visita." };
  }
  return { ok: true, issuedOn: issued, validUntil: until };
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
  if (!isIsoDate(record.issuedOn) || !isIsoDate(record.validUntil)) return null;
  return {
    athleteId,
    issuedOn: record.issuedOn,
    validUntil: record.validUntil,
    by: record.by === "staff" ? "staff" : "parent",
    updatedBy: typeof record.updatedBy === "string" && record.updatedBy ? record.updatedBy : null,
    updatedAt: typeof record.updatedAt === "string" && record.updatedAt ? record.updatedAt : new Date(0).toISOString(),
  };
}

export function serializeCertificate(certificate: MedicalCertificate): string {
  const { issuedOn, validUntil, by, updatedBy, updatedAt } = certificate;
  return JSON.stringify({ issuedOn, validUntil, by, updatedBy, updatedAt });
}

/**
 * Il messaggio da mandare al genitore quando il certificato scade, è scaduto o mancano le date: che cosa succede e, se c'è, il link
 * personale da cui scrivere le date nuove. Null se è in regola.
 */
export function parentReminder(athleteName: string, status: CertificateStatus, link: string | null): string | null {
  const first = athleteName.trim().split(/\s+/)[0] ?? athleteName;
  let what: string;
  switch (status.kind) {
    case "valid":
      return null;
    case "missing":
      what = `ci mancano le date del certificato medico di ${first}.`;
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
      ? `Quando avete fatto la visita, scrivete qui il giorno e fino a quando vale (non serve mandare il certificato): ${link}`
      : "Quando avete fatto la visita, diteci il giorno e fino a quando vale.",
  ].join("\n");
}
