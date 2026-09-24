import { matchTitle } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

/** Un evento del calendario dura sempre esattamente quanto sa l'app tranne
 * le partite, di cui non è modellata un'ora di fine: qui si stima una durata
 * tipica (riscaldamento incluso), pensata per l'app Calendario del
 * telefono, non per un uso agonistico del dato. */
const DEFAULT_MATCH_DURATION_MINUTES = 120;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Formatta data+ora locali (senza fuso, TZID implicito Europe/Rome: tutto
 * il club è nello stesso fuso, e floating time evita complicazioni DST). */
function toICSDateTime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}

function addMinutes(dateStr: string, timeStr: string, minutes: number): { date: string; time: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm + minutes);
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

/** RFC 5545: virgole, punti e virgola e newline vanno protetti con backslash. */
function escapeICSText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

/** RFC 5545: le righe vanno spezzate a 75 ottetti, continuazione con uno
 * spazio iniziale — senza, alcuni client (es. Outlook) troncano o ignorano
 * le righe più lunghe. */
function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    const size = i === 0 ? 75 : 74;
    chunks.push(line.slice(i, i + size));
    i += size;
  }
  return chunks.join("\r\n ");
}

export function eventTitle(event: CalendarEvent): string {
  return event.kind === "training" ? event.title : matchTitle(event);
}

function eventDescription(event: CalendarEvent): string | null {
  if (event.kind === "training") return event.notes;
  const parts: string[] = [];
  if (event.isFriendly) parts.push("Amichevole");
  if (event.meetingTime || event.meetingLocation) {
    parts.push(
      `Ritrovo${event.meetingTime ? ` alle ${event.meetingTime}` : ""}${event.meetingLocation ? ` · ${event.meetingLocation}` : ""}`,
    );
  }
  if (event.notes) parts.push(event.notes);
  return parts.length > 0 ? parts.join("\n") : null;
}

function eventToVEVENT(event: CalendarEvent, stamp: string): string[] {
  const start =
    event.kind === "training" ? toICSDateTime(event.date, event.startTime) : toICSDateTime(event.date, event.time);
  const end =
    event.kind === "training"
      ? toICSDateTime(event.date, event.endTime)
      : (() => {
          const e = addMinutes(event.date, event.time, DEFAULT_MATCH_DURATION_MINUTES);
          return toICSDateTime(e.date, e.time);
        })();
  const description = eventDescription(event);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@volley-lignano`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICSText(eventTitle(event))}`,
    `LOCATION:${escapeICSText(event.location)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  lines.push("END:VEVENT");
  return lines;
}

function nowStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Calendario completo (feed .ics con più eventi, per l'abbonamento). */
export function buildICSCalendar(events: CalendarEvent[], calendarName: string): string {
  const stamp = nowStamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Volley Lignano//Calendario pubblico//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Rome",
    ...events.flatMap((event) => eventToVEVENT(event, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldICSLine).join("\r\n") + "\r\n";
}

/** Singolo evento (download rapido dal dettaglio di un evento). */
export function buildICSSingleEvent(event: CalendarEvent): string {
  return buildICSCalendar([event], eventTitle(event));
}
