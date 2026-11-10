import { addDays, format, subDays } from "date-fns";
import { getPublicCalendarData } from "@/lib/publicCalendarData";
import { expandTrainings, matchesToEvents, occurrenceKey, sortEvents } from "@/lib/calendar";
import { CATEGORY_LABELS, parseCategoryFilter } from "@/lib/category";
import { buildICSCalendar } from "@/lib/ics";

/** Abbonamento .ics al calendario pubblico: un mese indietro (per chi si
 * abbona a metà mese e vuole ancora vedere cos'è successo di recente) e un
 * anno avanti, ampio abbastanza da non richiedere un rinnovo frequente da
 * parte dei client calendario, che ricaricano questo indirizzo da soli a
 * intervalli propri.
 *
 * `?solo=partite`: solo le partite (niente allenamenti), da un anno indietro
 * a un anno avanti, così nel calendario restano anche quelle già giocate,
 * con il risultato. È l'indirizzo da aggiungere «Da URL» in Google Calendar
 * (o come abbonamento in Calendario dell'iPhone): ogni partita ha sempre lo
 * stesso identificativo, quindi un cambio di orario o di palestra aggiorna
 * l'evento che c'è già e una partita cancellata sparisce. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // `?cat=U14` o `?cat=U15`: solo le partite di quella categoria (gli allenamenti restano, sono di tutte).
  const category = parseCategoryFilter(params.get("cat"));
  const onlyMatches = params.get("solo") === "partite";
  const today = new Date();
  const start = subDays(today, onlyMatches ? 365 : 30);
  const end = addDays(today, 365);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { trainings, matches, occurrencePlans } = await getPublicCalendarData(
    startStr,
    endStr,
    category === "all" ? undefined : category,
  );

  const occurrencePlanIds = new Map(
    occurrencePlans
      .filter((o) => o.isPublic)
      .map((o) => [occurrenceKey(o.trainingRuleId, o.occurrenceDate), o.planId] as const),
  );
  const trainingEvents = onlyMatches ? [] : expandTrainings(trainings, start, end, occurrencePlanIds);
  const events = sortEvents([...trainingEvents, ...matchesToEvents(matches)]);

  const name = `Volley Lignano${category === "all" ? "" : ` ${CATEGORY_LABELS[category]}`}${onlyMatches ? " · Partite" : ""}`;
  const fileName = ["volley-lignano", category === "all" ? null : category.toLowerCase(), onlyMatches ? "partite" : null]
    .filter(Boolean)
    .join("-");
  const ics = buildICSCalendar(events, name);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${fileName}.ics"`,
      // Solo partite: lo legge ogni 5 minuti lo script per Google Calendar (scripts/google-calendar), quindi la copia
      // della rete di Vercel dura un minuto, così un cambio arriva nel calendario in pochi minuti.
      "Cache-Control": onlyMatches ? "public, max-age=60" : "public, max-age=300",
    },
  });
}
