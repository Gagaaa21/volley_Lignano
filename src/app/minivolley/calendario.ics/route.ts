import { addDays, format, subDays } from "date-fns";
import { getPublicCalendarData } from "@/lib/publicCalendarData";
import { expandTrainings, matchesToEvents, occurrenceKey, sortEvents } from "@/lib/calendar";
import { buildICSCalendar } from "@/lib/ics";

/** Come /calendario.ics ma solo per la squadra Minivolley (allenamenti,
 * tornei e partite). */
export async function GET() {
  const today = new Date();
  const start = subDays(today, 30);
  const end = addDays(today, 365);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { trainings, matches, occurrencePlans } = await getPublicCalendarData(
    startStr,
    endStr,
    undefined,
    "minivolley",
  );

  const occurrencePlanIds = new Map(
    occurrencePlans
      .filter((o) => o.isPublic)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const events = sortEvents([...expandTrainings(trainings, start, end, occurrencePlanIds), ...matchesToEvents(matches)]);

  const ics = buildICSCalendar(events, "Volley Lignano Minivolley");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="volley-lignano-minivolley.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
