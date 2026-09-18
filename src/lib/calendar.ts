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

/**
 * Expands recurring training rules into concrete dated instances within
 * [rangeStart, rangeEnd] (inclusive, both at day precision).
 */
export function expandTrainings(
  trainings: TrainingRule[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const rule of trainings) {
    if (!rule.isActive || rule.weekdays.length === 0) continue;

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
    notes: m.notes,
  }));
}

export function eventTime(event: CalendarEvent): string {
  return event.kind === "training" ? event.startTime : event.time;
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return eventTime(a).localeCompare(eventTime(b));
  });
}
