import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type { CalendarEvent, Match, TrainingRule } from "@/lib/types";

/** Orario e luogo di una data di un allenamento. */
export interface OccurrenceSchedule {
  startTime: string;
  endTime: string;
  location: string;
  /** Orario e luogo di sempre, se quella data è stata cambiata solo per quella volta; altrimenti null. */
  usual: { startTime: string; endTime: string; location: string } | null;
}

/**
 * Orario e luogo di un allenamento in una certa data: quelli della regola,
 * oppure quelli cambiati solo per quel giorno (vedi
 * TrainingRule.occurrenceOverrides). Un allenamento singolo si modifica
 * direttamente, quindi per "once" valgono sempre quelli della regola.
 */
export function occurrenceSchedule(rule: TrainingRule, date: string): OccurrenceSchedule {
  const override =
    rule.repeat === "once" ? undefined : (rule.occurrenceOverrides ?? []).find((o) => o.date === date);
  if (!override) {
    return { startTime: rule.startTime, endTime: rule.endTime, location: rule.location, usual: null };
  }
  return {
    startTime: override.startTime,
    endTime: override.endTime,
    location: override.location.trim() || rule.location,
    usual: { startTime: rule.startTime, endTime: rule.endTime, location: rule.location },
  };
}

export function getMonthGridRange(monthDate: Date): { start: Date; end: Date } {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  return { start, end };
}

/** Finestra fissa di 30 giorni da oggi (oggi incluso) per la sezione Agenda
 * della home pubblica: indipendente dal mese eventualmente navigato nel
 * calendario sopra, così l'elenco resta sempre ancorato a oggi invece che
 * al mese in visualizzazione. */
export function getUpcomingAgendaRange(today: Date = new Date()): { start: Date; end: Date } {
  return { start: today, end: addDays(today, 29) };
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of sortEvents(events)) {
    const list = map.get(event.date);
    if (list) list.push(event);
    else map.set(event.date, [event]);
  }
  return map;
}

export function occurrenceKey(trainingRuleId: string, date: string): string {
  return `${trainingRuleId}_${date}`;
}

/**
 * Expands recurring training rules into concrete dated instances within
 * [rangeStart, rangeEnd] (inclusive, both at day precision). occurrencePlanIds
 * maps occurrenceKey(ruleId, date) -> planId, per una scheda collegata a una
 * singola data (vedi TrainingOccurrencePlan): se assente, l'evento ha
 * planId: null anche se la regola stessa è ricorrente.
 */
export function expandTrainings(
  trainings: TrainingRule[],
  rangeStart: Date,
  rangeEnd: Date,
  occurrencePlanIds: Map<string, string> = new Map(),
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const rule of trainings) {
    if (!rule.isActive) continue;

    if (rule.repeat === "once") {
      const eventDate = parseISO(rule.startDate);
      if (eventDate >= rangeStart && eventDate <= rangeEnd) {
        events.push({
          kind: "training",
          id: `${rule.id}:${rule.startDate}`,
          ruleId: rule.id,
          date: rule.startDate,
          startTime: rule.startTime,
          endTime: rule.endTime,
          title: rule.title,
          location: rule.location,
          notes: rule.notes,
          planId: occurrencePlanIds.get(occurrenceKey(rule.id, rule.startDate)) ?? null,
          team: rule.team,
          isTournament: rule.isTournament,
          color: rule.color,
          usual: null,
        });
      }
      continue;
    }

    if (rule.weekdays.length === 0) continue;

    const ruleStart = parseISO(rule.startDate);
    const ruleEnd = rule.endDate ? parseISO(rule.endDate) : null;
    const excludedDates = new Set(rule.excludedDates ?? []);

    let cursor = ruleStart > rangeStart ? ruleStart : rangeStart;
    const upperBound = ruleEnd && ruleEnd < rangeEnd ? ruleEnd : rangeEnd;

    let safety = 0;
    while (cursor <= upperBound && safety < 400) {
      safety += 1;
      const dateStr = format(cursor, "yyyy-MM-dd");
      if (rule.weekdays.includes(cursor.getDay()) && !excludedDates.has(dateStr)) {
        // Orario e luogo possono essere stati cambiati solo per questa data.
        const schedule = occurrenceSchedule(rule, dateStr);
        events.push({
          kind: "training",
          id: `${rule.id}:${dateStr}`,
          ruleId: rule.id,
          date: dateStr,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          usual: schedule.usual,
          title: rule.title,
          location: schedule.location,
          notes: rule.notes,
          planId: occurrencePlanIds.get(occurrenceKey(rule.id, dateStr)) ?? null,
          team: rule.team,
          isTournament: rule.isTournament,
          color: rule.color,
        });
      }
      cursor = addDays(cursor, 1);
    }
  }

  return events;
}

export function matchesToEvents(matches: Match[]): CalendarEvent[] {
  return matches.map((m) => ({
    kind: "match",
    id: m.id,
    date: m.matchDate.slice(0, 10),
    time: m.matchDate.slice(11, 16),
    team: m.team,
    category: m.category,
    opponent: m.opponent,
    isHome: m.isHome,
    location: m.location,
    isFriendly: m.isFriendly,
    isTournament: m.isTournament,
    meetingTime: m.meetingTime,
    meetingLocation: m.meetingLocation,
    notes: m.notes,
    setScores: m.setScores,
    resultSetsWon: m.resultSetsWon,
    resultSetsLost: m.resultSetsLost,
    tournamentGames: m.tournamentGames,
  }));
}

export function eventTime(event: CalendarEvent): string {
  return event.kind === "training" ? event.startTime : event.time;
}

/**
 * Titolo di una partita: "vs {avversaria}" nel caso comune, ma senza
 * anteporre "vs" quando è un torneo/triangolare — lì "opponent" descrive
 * l'evento ("Triangolare con Latisana e Concordia"), non una singola
 * squadra, quindi "vs" davanti non avrebbe senso grammaticale. Un'unica
 * funzione condivisa da tutti i punti del sito che mostrano il nome di una
 * partita, invece di ripetere la stessa concatenazione ovunque.
 */
export function matchTitle(match: { opponent: string; isTournament: boolean }): string {
  return match.isTournament ? match.opponent : `vs ${match.opponent}`;
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return eventTime(a).localeCompare(eventTime(b));
  });
}
