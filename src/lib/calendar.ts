import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import type { CalendarEvent, Match, TrainingRule } from "@/lib/types";

export function getMonthGridRange(monthDate: Date): { start: Date; end: Date } {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  return { start, end };
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
        });
      }
      continue;
    }

    if (rule.weekdays.length === 0) continue;

    const ruleStart = parseISO(rule.startDate);
    const ruleEnd = rule.endDate ? parseISO(rule.endDate) : null;

    let cursor = ruleStart > rangeStart ? ruleStart : rangeStart;
    const upperBound = ruleEnd && ruleEnd < rangeEnd ? ruleEnd : rangeEnd;

    let safety = 0;
    while (cursor <= upperBound && safety < 400) {
      safety += 1;
      if (rule.weekdays.includes(cursor.getDay())) {
        const dateStr = format(cursor, "yyyy-MM-dd");
        events.push({
          kind: "training",
          id: `${rule.id}:${dateStr}`,
          ruleId: rule.id,
          date: dateStr,
          startTime: rule.startTime,
          endTime: rule.endTime,
          title: rule.title,
          location: rule.location,
          notes: rule.notes,
          planId: occurrencePlanIds.get(occurrenceKey(rule.id, dateStr)) ?? null,
          team: rule.team,
          isTournament: rule.isTournament,
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
