import type { Metadata } from "next";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { newScoutData } from "@/lib/scout/actions";
import { isScoutTableMissing } from "@/lib/scout/missing";
import { requireScoutMatch } from "@/lib/scout/server";
import type { MatchScout } from "@/lib/scout/types";
import { ScoutSetupNeeded } from "@/components/scout/ScoutSetupNeeded";
import { ScoutClient } from "./ScoutClient";
import type { SavedScoutLineup } from "./ScoutLineupEditor";
import type { ScoutAthlete } from "./ScoutSetup";

export const metadata: Metadata = {
  title: "Scout partita",
};

export default async function ScoutMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ guida?: string }>;
}) {
  const { matchId } = await params;
  const { guida } = await searchParams;
  const { session, repo, match } = await requireScoutMatch(matchId);
  let scout: MatchScout | null;
  let athletes: Awaited<ReturnType<typeof repo.listAthletes>>;
  let lineup: Awaited<ReturnType<typeof repo.getMatchLineup>>;
  try {
    [scout, athletes, lineup] = await Promise.all([
      repo.getMatchScout(matchId),
      repo.listAthletes({ team: match.team }),
      repo.getMatchLineup(matchId),
    ]);
  } catch (error) {
    if (!isScoutTableMissing(error)) throw error;
    return <ScoutSetupNeeded isDev={session.role === "dev"} />;
  }

  // Chi si può scegliere: tutte le atlete attive, prima le convocate, poi quelle della stessa categoria.
  const calledUp = new Set(match.calledUpAthleteIds);
  const candidates: ScoutAthlete[] = athletes
    .filter((athlete) => athlete.isActive)
    .map((athlete) => ({
      id: athlete.id,
      name: athlete.fullName,
      calledUp: calledUp.has(athlete.id),
      sameCategory: match.category !== null && athlete.category === match.category,
      // Il numero di maglia si scrive una volta nell'anagrafica atlete e da lì arriva qui.
      number: athlete.jerseyNumber === null || athlete.jerseyNumber === undefined ? null : String(athlete.jerseyNumber),
    }))
    .sort(
      (a, b) =>
        Number(b.calledUp) - Number(a.calledUp) || Number(b.sameCategory) - Number(a.sameCategory) || a.name.localeCompare(b.name, "it"),
    )
    .map(({ id, name, calledUp: isCalledUp, number }) => ({ id, name, calledUp: isCalledUp, number }));

  // Se non esiste ancora uno scout, si parte con le convocate già in rosa, ognuna col numero dell'anagrafica (libero a parte).
  const blank = newScoutData({
    us: candidates.filter((athlete) => athlete.calledUp).map((athlete) => ({ id: athlete.id, name: athlete.name, number: athlete.number, libero: false })),
    opp: [],
  });

  // Le formazioni preparate in Partite (una per set): in Scout si possono usare per cominciare in un tocco.
  const savedLineups: SavedScoutLineup[] = (lineup?.sets ?? []).map((set) => ({
    athleteIds: set.slots.map((slot) => slot.athleteId),
    roles: set.slots.map((slot) => slot.role),
    liberoId: set.liberoIds[0] ?? null,
  }));

  return (
    <ScoutClient
      key={match.id}
      match={{
        id: match.id,
        title: matchTitle(match),
        dateLabel: formatDateLong(match.matchDate.slice(0, 10)),
        time: match.matchDate.slice(11, 16),
        location: match.location,
        category: match.category,
        categoryLabel: match.category ? CATEGORY_LABELS[match.category] : null,
        isFriendly: match.isFriendly,
      }}
      athletes={candidates}
      savedLineups={savedLineups}
      initial={scout}
      blank={blank}
      autoGuide={guida === "1"}
    />
  );
}
