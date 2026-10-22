import { cleanPhone, isValidPhone, nameKey } from "./phone";
import { MAX_CONTACTS_PER_ATHLETE, type AthleteContact, type AthleteContacts } from "./types";

/** La rubrica dei genitori: lettura difensiva di quanto salvato, controllo di quanto scritto nel modulo, ricerca per nome. */

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, max);
  return trimmed || null;
};

/** Rilegge i contatti salvati scartando le righe rovinate (senza nome o con un numero che non è un numero). */
export function normalizeContacts(raw: unknown): AthleteContact[] {
  if (!Array.isArray(raw)) return [];
  const contacts: AthleteContact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const value = item as Record<string, unknown>;
    const name = text(value.name, 60);
    const phone = typeof value.phone === "string" ? cleanPhone(value.phone) : "";
    if (!name || !isValidPhone(phone)) continue;
    contacts.push({ name, phone, relation: text(value.relation, 30) });
    if (contacts.length === MAX_CONTACTS_PER_ATHLETE) break;
  }
  return contacts;
}

export interface ContactRowInput {
  name: string;
  phone: string;
  relation: string;
}

export type ParsedContacts = { ok: true; contacts: AthleteContact[] } | { ok: false; error: string };

/**
 * I contatti scritti nel modulo di un'atleta. Una riga del tutto vuota si ignora; una con il numero ma senza nome (o il
 * contrario) è un errore da correggere; lo stesso numero scritto due volte conta una volta.
 */
export function parseContactRows(rows: readonly ContactRowInput[]): ParsedContacts {
  const contacts: AthleteContact[] = [];
  const seenPhones = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const name = text(row.name, 60);
    const phone = cleanPhone(row.phone);
    const relation = text(row.relation, 30);
    if (!name && !phone && !relation) continue;
    const label = `Riga ${index + 1}`;
    if (!name) return { ok: false, error: `${label}: scrivi il nome di chi si deve chiamare.` };
    if (!phone) return { ok: false, error: `${label}: manca il numero di ${name}.` };
    if (!isValidPhone(phone)) {
      return { ok: false, error: `${label}: il numero di ${name} non sembra un numero di telefono (solo cifre, spazi e un + iniziale).` };
    }
    const digits = phone.replace(/\D/g, "");
    if (seenPhones.has(digits)) continue;
    seenPhones.add(digits);
    contacts.push({ name, phone, relation });
  }
  if (contacts.length > MAX_CONTACTS_PER_ATHLETE) {
    return { ok: false, error: `Al massimo ${MAX_CONTACTS_PER_ATHLETE} numeri per atleta.` };
  }
  return { ok: true, contacts };
}

/**
 * Il numero di chi guida, preso dalla rubrica quando non lo si è scritto: serve un solo nome uguale (senza badare a
 * maiuscole e accenti) e un solo numero, altrimenti non si sceglie al posto di chi compila.
 */
export function phoneForName(rubrica: readonly AthleteContacts[], name: string): string | null {
  const wanted = nameKey(name);
  if (!wanted) return null;
  const phones = new Map<string, string>();
  for (const entry of rubrica) {
    for (const contact of entry.contacts) {
      if (nameKey(contact.name) !== wanted) continue;
      const digits = contact.phone.replace(/\D/g, "");
      // Lo stesso numero scritto in due modi vale una volta: resta la prima scrittura.
      if (!phones.has(digits)) phones.set(digits, contact.phone);
    }
  }
  return phones.size === 1 ? [...phones.values()][0] : null;
}

/** I nomi in rubrica, una volta ciascuno, per i suggerimenti mentre si scrive il nome di chi guida. */
export function contactNames(rubrica: readonly AthleteContacts[]): string[] {
  const names = new Map<string, string>();
  for (const entry of rubrica) {
    for (const contact of entry.contacts) {
      const key = nameKey(contact.name);
      if (!names.has(key)) names.set(key, contact.name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, "it"));
}
