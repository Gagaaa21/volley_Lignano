import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaffPage } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { contactNames } from "@/lib/trips/contacts";
import { isTripTableMissing } from "@/lib/trips/missing";
import { suggestVehicles } from "@/lib/trips/rules";
import { emptyTripData, type AthleteContacts, type MatchTrip } from "@/lib/trips/types";
import type { Athlete } from "@/lib/types";
import { SectionTour } from "@/components/tour/SectionTour";
import { getTripTourSteps } from "@/components/tour/sectionSteps";
import { TripBoard } from "@/components/trips/TripBoard";
import { TripPdfButtons } from "@/components/trips/TripPdfButtons";
import { TripsSetupNeeded } from "@/components/trips/TripsSetupNeeded";
import type { BoardPerson } from "@/components/trips/boardTypes";
import { Button } from "@/components/ui/Button";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Label, Textarea } from "@/components/ui/Field";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { saveTripNotesAction } from "../actions";

export const metadata: Metadata = {
  title: "Trasferta",
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ errore?: string }>;
}) {
  const { matchId } = await params;
  const { errore } = await searchParams;
  const session = await requireStaffPage("trasferte");
  const repo = await getActiveRepo();

  const match = await repo.getMatch(matchId);
  if (!match || match.team !== "u14u15") notFound();

  let trip: MatchTrip | null;
  let trips: MatchTrip[];
  let rubrica: AthleteContacts[];
  let athletes: Athlete[];
  try {
    [trip, trips, rubrica, athletes] = await Promise.all([
      repo.getMatchTrip(matchId),
      repo.listMatchTrips(),
      repo.listAthleteContacts(),
      repo.listAthletes({ team: "u14u15" }),
    ]);
  } catch (error) {
    if (!isTripTableMissing(error)) throw error;
    return (
      <div>
        <PageHeader back={{ href: "/admin/trasferte", label: "Trasferte" }} title="Trasferta" />
        <TripsSetupNeeded isDev={session.role === "dev"} />
      </div>
    );
  }

  const data = trip ?? emptyTripData();
  const athleteById = new Map<string, Athlete>(athletes.map((a) => [a.id, a] as const));
  const contactsByAthlete = new Map(rubrica.map((entry) => [entry.athleteId, entry.contacts] as const));

  // Chi serve alla lavagna: le convocate e chi è già su un mezzo (anche se non è più convocata).
  const people: Record<string, BoardPerson> = {};
  for (const athleteId of new Set([...match.calledUpAthleteIds, ...data.vehicles.flatMap((vehicle) => vehicle.athleteIds)])) {
    const athlete = athleteById.get(athleteId);
    if (athlete) people[athleteId] = { name: athlete.fullName, contacts: contactsByAthlete.get(athleteId) ?? [] };
  }

  // I mezzi usati nelle altre trasferte (dalla più recente), per rimetterli con un tocco; e i nomi da suggerire mentre si scrive.
  const otherTrips = trips.filter((other) => other.matchId !== matchId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const suggestions = suggestVehicles(otherTrips, data);
  const driverNames = contactNames(rubrica);
  const usedOwners = trips.flatMap((other) => other.vehicles.flatMap((vehicle) => (vehicle.ownerName ? [vehicle.ownerName] : [])));
  const ownerNames = [...new Set(["Società", ...driverNames, ...usedOwners])].sort((a, b) => a.localeCompare(b, "it"));

  const canOpenMatch = session.role === "dev" || ((await getOwnStaff(session.sub))?.allowedPages.includes("partite") ?? false);
  const meeting = [match.meetingTime ? `ore ${match.meetingTime}` : null, match.meetingLocation].filter(Boolean).join(" · ");

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/trasferte", label: "Trasferte" }}
        eyebrow={match.category ? <CategoryTag category={match.category} size="md" long /> : MATCH_NO_CATEGORY_LABEL}
        title={matchTitle(match)}
        description={`${formatDateLong(match.matchDate.slice(0, 10))} · ${match.matchDate.slice(11, 16)} · ${match.location}`}
        help={<SectionTour steps={getTripTourSteps(match.id)} />}
        actions={
          <>
            {canOpenMatch && (
              <LinkButton href={`/admin/partite/${match.id}`} variant="outline" data-trip-match-link>
                Apri la partita
              </LinkButton>
            )}
            <TripPdfButtons matchId={match.id} title={`Trasferta ${matchTitle(match)}`} />
          </>
        }
      />

      {errore && (
        <p role="alert" data-trip-error className="mb-5 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {errore}
        </p>
      )}

      <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-trip-meeting>
        <Clock className="h-4 w-4 shrink-0" aria-hidden />
        {meeting ? (
          <>
            <span className="font-semibold text-foreground/80">Ritrovo</span> {meeting}
          </>
        ) : (
          "Ritrovo non indicato: se è diverso dall'orario della partita, scrivilo nella partita."
        )}
      </p>

      {match.calledUpAthleteIds.length === 0 && (
        <p className="mb-8 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" data-trip-no-called-up>
          Per questa partita non ci sono ancora convocate, quindi non c&apos;è nessuno da mettere sui mezzi.{" "}
          {canOpenMatch ? (
            <a href={`/admin/partite/${match.id}`} className="font-semibold underline">
              Scegli le convocate dalla partita
            </a>
          ) : (
            "Chi gestisce le partite può sceglierle."
          )}
        </p>
      )}

      <TripBoard
        matchId={match.id}
        vehicles={data.vehicles}
        people={people}
        calledUpIds={match.calledUpAthleteIds}
        suggestions={suggestions}
        driverNames={driverNames}
        ownerNames={ownerNames}
        notes={
          <section data-tour="section-trasferta-notes">
            <SectionHeading title="Note riservate" description="Pranzo, costi, rientro… restano qui." />
            <form action={saveTripNotesAction} className="space-y-3" data-trip-notes-form>
              <input type="hidden" name="matchId" value={match.id} />
              <Label htmlFor="trip-notes" className="sr-only">
                Note sulla trasferta
              </Label>
              <Textarea id="trip-notes" name="notes" defaultValue={data.notes ?? ""} maxLength={2000} placeholder="Es. pranzo al sacco, rientro verso le 20" />
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="outline" data-trip-notes-save>
                  Salva le note
                </Button>
              </div>
            </form>
          </section>
        }
      />
    </div>
  );
}
