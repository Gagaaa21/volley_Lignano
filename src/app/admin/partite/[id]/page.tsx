import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Binoculars, Car } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaff } from "@/lib/auth/guard";
import { isScoutable } from "@/lib/scout/match";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { describeAbsence, isAbsence } from "@/lib/availability/rules";
import type { MatchAvailability as MatchAvailabilityRow } from "@/lib/availability/types";
import { matchTitle } from "@/lib/calendar";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { todayIso } from "@/lib/today";
import { MatchDetailsCard } from "../MatchDetailsCard";
import { MatchResultCard } from "../MatchResultCard";
import { MatchWorkspace } from "../MatchWorkspace";

export const metadata: Metadata = {
  title: "Partita",
};

/**
 * La scheda di una partita, nell'ordine in cui serve: i dettagli in breve (con «Modifica», che apre il modulo a parte), il
 * risultato a partita giocata e le convocazioni con le formazioni (con l'avviso accanto a chi non ci sarà; le assenze si gestiscono
 * nella sezione Assenze).
 */

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  if (!match) notFound();
  // Collegamento allo scout della partita, solo a chi ha il permesso (e per le partite che ne hanno uno).
  const canScout =
    isScoutable(match) &&
    (session.role === "dev" || ((await getOwnStaff(session.sub))?.allowedPages.includes("scout") ?? false));
  // Idem per la trasferta (sezione riservata): il collegamento c'è solo per le partite fuori casa e solo a chi ha il permesso.
  const canTrip =
    match.team === "u14u15" &&
    !match.isHome &&
    (session.role === "dev" || ((await getOwnStaff(session.sub))?.allowedPages.includes("trasferte") ?? false));
  // Solo atlete della stessa squadra della partita.
  const [allAthletes, lineup] = await Promise.all([
    repo.listAthletes({ team: match.team }),
    repo.getMatchLineup(id),
  ]);

  const activeAthletes = allAthletes.filter((a) => a.isActive);

  // Le assenze (solo U14/U15) si gestiscono nella sezione Assenze; qui servono solo all'avviso accanto alle convocate che non ci
  // saranno. Finché la tabella non c'è, nessun avviso.
  let answerRows: MatchAvailabilityRow[] = [];
  if (match.team === "u14u15") {
    try {
      answerRows = await repo.listMatchAvailability({ matchIds: [id] });
    } catch (error) {
      if (!isAvailabilityTableMissing(error)) throw error;
    }
  }
  const absenceTexts: Record<string, string> = Object.fromEntries(
    answerRows.filter(isAbsence).map((row) => [row.athleteId, describeAbsence(row)] as const),
  );
  // Il risultato si scrive a partita giocata (o si corregge se c'è già).
  const played = match.matchDate.slice(0, 10) <= todayIso();
  const showResult = played || match.resultSetsWon !== null || (match.tournamentGames?.some((game) => game.setScores.length > 0) ?? false);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/partite", label: "Partite" }}
        eyebrow={match.category ? <CategoryTag category={match.category} size="md" long /> : MATCH_NO_CATEGORY_LABEL}
        title={matchTitle(match)}
        description={`${formatDateLong(match.matchDate.slice(0, 10))} · ${match.matchDate.slice(11, 16)} · ${match.location}`}
        actions={
          canScout || canTrip ? (
            <>
              {canTrip && (
                <LinkButton href={`/admin/trasferte/${match.id}`} variant="outline" data-match-trip-link>
                  <Car className="h-4 w-4" />
                  Trasferta
                </LinkButton>
              )}
              {canScout && (
                <LinkButton href={`/admin/scout/${match.id}`} variant="outline" data-match-scout-link>
                  <Binoculars className="h-4 w-4" />
                  Scout della partita
                </LinkButton>
              )}
            </>
          ) : undefined
        }
      />

      <MatchDetailsCard match={match} />

      {showResult && <MatchResultCard match={match} />}

      <MatchWorkspace
        matchId={id}
        title={matchTitle(match)}
        allAthletes={activeAthletes}
        initialCalledUpIds={match.calledUpAthleteIds}
        initialLineup={lineup}
        absences={absenceTexts}
        notifyByDefault={!played}
      />
    </div>
  );
}
