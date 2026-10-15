/**
 * Un'ora scritta a mano → "HH:MM". Accetta 17:30, 17.30, 17,30, 17h30, 1730, 930, 17 (= 17:00), con o senza spazi, con
 * «ore» davanti e con i secondi in coda (17:30:00, come mandano alcuni browser). Vuoto = nessuna ora (`value: null`).
 * Serve sia al campo dell'ora (che la sistema quando si esce dal campo) sia al server (che non si fida di quel che arriva).
 */
export type ClockTime = { ok: true; value: string | null } | { ok: false };

const pad = (n: number) => String(n).padStart(2, "0");

export function parseClockTime(raw: string | null | undefined): ClockTime {
  const text = (raw ?? "").replace(/\s+/g, "").replace(/^ore/i, "");
  if (text === "") return { ok: true, value: null };

  let hours: string;
  let minutes = "00";
  const withSeparator = /^(\d{1,2})[:.,hH](\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text);
  const hoursOnly = /^(\d{1,2})[:.,hH]?$/.exec(text);
  const digits = /^\d{3,4}$/.exec(text);
  if (withSeparator) {
    [, hours, minutes] = withSeparator;
  } else if (hoursOnly) {
    [, hours] = hoursOnly;
  } else if (digits) {
    hours = text.slice(0, text.length - 2);
    minutes = text.slice(-2);
  } else {
    return { ok: false };
  }

  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return { ok: false };
  return { ok: true, value: `${pad(h)}:${pad(m)}` };
}

/** "HH:MM" meno `minutes` minuti, nello stesso giorno; null se si andrebbe prima di mezzanotte (o l'ora di partenza non è valida). */
export function clockTimeMinusMinutes(time: string, minutes: number): string | null {
  const parsed = parseClockTime(time);
  if (!parsed.ok || !parsed.value) return null;
  const [h, m] = parsed.value.split(":").map(Number);
  const total = h * 60 + m - minutes;
  if (total < 0) return null;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
