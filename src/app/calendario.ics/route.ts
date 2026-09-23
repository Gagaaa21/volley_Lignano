import { addDays, format, subDays } from "date-fns";
import { getPublicCalendarData } from "@/lib/publicCalendarData";
import { expandTrainings, matchesToEvents, occurrenceKey, sortEvents } from "@/lib/calendar";
import { buildICSCalendar } from "@/lib/ics";

/** Abbonamento .ics al calendario pubblico: un mese indietro (per chi si
 * abbona a metà mese e vuole ancora vedere cos'è successo di recente) e un
 * anno avanti, ampio abbastanza da non richiedere un rinnovo frequente da
 * parte dei client calendario, che ricaricano questo indirizzo da soli a
 * intervalli propri. */
export async function GET() {
  const today = new Date();
  const start = subDays(today, 30);
  const end = addDays(today, 365);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { trainings, matches, occurrencePlans } = await getPublicCalendarData(startStr, endStr);

  const occurrencePlanIds = new Map(
    occurrencePlans
      .filter((o) => o.isPublic)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const events = sortEvents([...expandTrainings(trainings, start, end, occurrencePlanIds), ...matchesToEvents(matches)]);

  const ics = buildICSCalendar(events, "Volley Lignano");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="volley-lignano.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
