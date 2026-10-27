import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { missingAvailabilityTables } from "@/lib/availability/health";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { reportingView } from "@/lib/availability/reportingView";
import { staffNamesById } from "@/lib/availability/rules";
import type { MatchAvailability as MatchAvailabilityRow } from "@/lib/availability/types";
import { nowLocalIso, todayIso } from "@/lib/today";
import { AvailabilityDatabaseNotice } from "@/components/availability/AvailabilityDatabaseNotice";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { MatchAvailability } from "../../MatchAvailability";
import { ReportingControls } from "../../ReportingControls";
import { loadReporting, orEmpty } from "../../load";

export const metadata: Metadata = {
  title: "Assenze della partita",
};

/**
 * Le assenze di una partita, nella sezione Assenze: in alto come stanno le segnalazioni dei genitori (finché la partita non è giocata),
 * con i comandi per chiuderle, riaprirle, sceglierne la scadenza o lasciare un messaggio; sotto chi non ci sarà, da segnare o togliere
 * con un tocco, sempre, anche a partita finita.
 */
export default async function AssenzePartitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaffPage("partite");
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  if (!match || match.team !== "u14u15") notFound();

  // null = la tabella delle assenze manca (lo spiega l'avviso in cima).
  const [athletes, missing, { rules, settings }, rows, staff] = await Promise.all([
    repo.listAthletes({ team: "u14u15" }),
    missingAvailabilityTables(repo),
    loadReporting(repo, [id]),
    orEmpty<MatchAvailabilityRow[] | null>(repo.listMatchAvailability({ matchIds: [id] }), null, isAvailabilityTableMissing),
    repo.listStaff(),
  ]);
  const upcoming = match.setScores === null && match.resultSetsWon === null && match.matchDate.slice(0, 10) >= todayIso();
  const view = upcoming ? reportingView(match, rules, settings.get(id) ?? null, nowLocalIso()) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/assenze", label: "Assenze" }}
        eyebrow={match.category ? <CategoryTag category={match.category} size="md" long /> : MATCH_NO_CATEGORY_LABEL}
        title={matchTitle(match)}
        description={`${formatDateLong(match.matchDate.slice(0, 10))} · ${match.matchDate.slice(11, 16)} · ${match.location}`}
        actions={
          <LinkButton href={`/admin/partite/${match.id}`} variant="outline" data-assenze-match-link>
            <Swords className="h-4 w-4" />
            Scheda partita
          </LinkButton>
        }
      />

      <AvailabilityDatabaseNotice missing={missing} isDev={session.role === "dev"} />

      {view ? (
        <Card className="mb-6" data-match-reporting>
          <CardHeader className="pb-3">
            <CardTitle>Segnalazioni dei genitori</CardTitle>
          </CardHeader>
          <CardBody>
            <ReportingControls view={view} />
          </CardBody>
        </Card>
      ) : (
        <p className="mb-6 rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground" data-match-reporting-past>
          La partita è giocata: dal link i genitori non la vedono più. Le assenze qui sotto restano, e puoi ancora cambiarle.
        </p>
      )}

      {rows && (
        <MatchAvailability
          match={match}
          rows={rows}
          athletes={athletes.filter((athlete) => athlete.isActive)}
          staffNames={staffNamesById(staff)}
          myName={session.fullName}
        />
      )}
    </div>
  );
}
