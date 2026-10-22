import type { Metadata } from "next";
import { BookUser, Car, ChevronRight } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { CATEGORY_LABELS, parseCategoryFilter } from "@/lib/category";
import { todayIso } from "@/lib/today";
import { isTripTableMissing } from "@/lib/trips/missing";
import { summarizeTrip, tripStatus, type TripStatus } from "@/lib/trips/rules";
import { emptyTripData, type AthleteContacts, type MatchTrip } from "@/lib/trips/types";
import type { Match } from "@/lib/types";
import { CategoryFilterLinks } from "@/components/admin/CategoryFilterLinks";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_TRASFERTE_STEPS } from "@/components/tour/sectionSteps";
import { TripMatchRow } from "@/components/trips/TripMatchRow";
import { TripsSetupNeeded } from "@/components/trips/TripsSetupNeeded";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Trasferte",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Quante trasferte passate si mostrano nell'elenco ripiegato: le più recenti. */
const PAST_SHOWN = 10;

function statusLine(status: TripStatus, details: { vehicles: number; calledUp: number; placed: number; missing: number }): {
  text: string;
  tone: "ok" | "todo" | "muted";
} {
  switch (status) {
    case "no-called-up":
      return { text: "Nessuna convocata ancora: scegli le convocate dalla partita", tone: "muted" };
    case "no-vehicles":
      return { text: `Nessun mezzo ancora · ${plural(details.calledUp, "convocata", "convocate")}`, tone: "todo" };
    case "missing":
      return {
        text: `${plural(details.vehicles, "mezzo", "mezzi")} · ${details.placed} su ${details.calledUp} hanno un passaggio, ${
          details.missing === 1 ? "ne manca 1" : `ne mancano ${details.missing}`
        }`,
        tone: "todo",
      };
    case "done":
      return {
        text: `${plural(details.vehicles, "mezzo", "mezzi")} · tutte le ${details.calledUp} convocate hanno un passaggio`,
        tone: "ok",
      };
  }
}

export default async function TrasfertePage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const session = await requireStaffPage("trasferte");
  const { cat } = await searchParams;
  const category = parseCategoryFilter(cat);

  const repo = await getActiveRepo();
  let allMatches: Match[];
  let trips: MatchTrip[];
  let rubrica: AthleteContacts[];
  try {
    [allMatches, trips, rubrica] = await Promise.all([
      repo.listMatches({ team: "u14u15" }),
      repo.listMatchTrips(),
      repo.listAthleteContacts(),
    ]);
  } catch (error) {
    // Le tabelle delle trasferte non sono ancora state create su Supabase: si spiega cosa fare invece di una pagina d'errore.
    if (!isTripTableMissing(error)) throw error;
    return (
      <div>
        <PageHeader title="Trasferte" description="Mezzi, posti e chi va con chi per le partite fuori casa." />
        <TripsSetupNeeded isDev={session.role === "dev"} />
      </div>
    );
  }

  const tripByMatch = new Map(trips.map((trip) => [trip.matchId, trip]));
  // Una trasferta è una partita fuori casa; una partita in casa compare solo se qualcuno ci ha già scritto dei mezzi.
  const matches = allMatches.filter(
    (m) => (!m.isHome || tripByMatch.has(m.id)) && (category === "all" || m.category === category),
  );
  const today = todayIso();
  const upcoming = matches.filter((m) => m.matchDate.slice(0, 10) >= today).sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const past = matches
    .filter((m) => m.matchDate.slice(0, 10) < today)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate))
    .slice(0, PAST_SHOWN);

  const activeAthletes = (await repo.listAthletes({ team: "u14u15" })).filter((a) => a.isActive);
  const withNumbers = new Set(rubrica.filter((entry) => entry.contacts.length > 0).map((entry) => entry.athleteId));
  const athletesWithNumbers = activeAthletes.filter((a) => withNumbers.has(a.id)).length;

  const renderRow = (match: Match, isPast: boolean) => {
    const trip = tripByMatch.get(match.id);
    const summary = summarizeTrip(trip ?? emptyTripData(), match.calledUpAthleteIds);
    const line = statusLine(tripStatus(summary), {
      vehicles: summary.vehicles,
      calledUp: summary.calledUp,
      placed: summary.placed,
      missing: summary.unplaced.length,
    });
    return (
      <TripMatchRow
        key={match.id}
        match={match}
        data-trip-row={match.id}
        status={
          <p
            className={cn(
              "mt-1 text-xs font-semibold",
              line.tone === "ok" && "text-success",
              line.tone === "todo" && !isPast && "text-warning",
              (line.tone === "muted" || (line.tone === "todo" && isPast)) && "text-muted-foreground",
            )}
            data-trip-status
          >
            {line.text}
            {match.meetingTime ? ` · ritrovo ore ${match.meetingTime}` : ""}
          </p>
        }
        action={
          <LinkButton href={`/admin/trasferte/${match.id}`} variant={isPast || line.tone === "ok" ? "outline" : "primary"} size="sm" data-trip-open>
            <Car className="h-3.5 w-3.5" />
            {isPast || summary.vehicles > 0 ? "Apri" : "Organizza"}
            <ChevronRight className="h-3.5 w-3.5" />
          </LinkButton>
        }
      />
    );
  };

  return (
    <div>
      <PageHeader
        title="Trasferte"
        description="Mezzi, posti e chi va con chi per le partite fuori casa. Sezione riservata: la vede solo chi ha il permesso."
        help={<SectionTour steps={SECTION_TRASFERTE_STEPS} />}
        actions={
          <LinkButton href="/admin/trasferte/rubrica" variant="outline" data-tour="section-trasferte-rubrica" data-trips-rubrica-link>
            <BookUser className="h-4 w-4" />
            Rubrica genitori
            <span className="text-xs font-normal text-muted-foreground">
              {athletesWithNumbers} su {activeAthletes.length}
            </span>
          </LinkButton>
        }
      />

      <CategoryFilterLinks path="/admin/trasferte" active={category} className="mb-6" />

      <div className="space-y-9">
        <section data-tour="section-trasferte-list">
          <SectionHeading title="Prossime trasferte" />
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-10 text-center text-sm text-muted-foreground">
              {category === "all"
                ? "Nessuna partita fuori casa in programma. Compare qui appena ne inserisci una in Partite con «Trasferta»."
                : `Nessuna trasferta ${CATEGORY_LABELS[category]} in programma.`}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {upcoming.map((match) => renderRow(match, false))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <details className="group">
            <summary className="mb-3 cursor-pointer font-display text-lg font-bold leading-tight tracking-[-0.012em] text-foreground">
              Trasferte passate
            </summary>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {past.map((match) => renderRow(match, true))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
