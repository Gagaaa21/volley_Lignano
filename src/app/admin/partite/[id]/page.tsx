import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Binoculars, Car, Trash2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaff } from "@/lib/auth/guard";
import { isScoutable } from "@/lib/scout/match";
import { matchTitle } from "@/lib/calendar";
import { Card, CardBody } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { deleteMatchAction } from "../actions";
import { MatchForm } from "../MatchForm";
import { MatchWorkspace } from "../MatchWorkspace";

export const metadata: Metadata = {
  title: "Modifica partita",
};

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
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

      <MatchWorkspace
        matchId={id}
        title={matchTitle(match)}
        allAthletes={activeAthletes}
        initialCalledUpIds={match.calledUpAthleteIds}
        initialLineup={lineup}
      />

      <Card className="mt-6">
        <CardBody className="pt-6 sm:pt-7">
          <MatchForm match={match} />
        </CardBody>
      </Card>

      <section className="mt-10 flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Elimina partita</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Sparisce dal calendario insieme a convocazioni, formazioni e scout.</p>
        </div>
        <form action={deleteMatchAction}>
          <input type="hidden" name="id" value={match.id} />
          <ConfirmSubmitButton confirmMessage={`Eliminare la partita ${matchTitle(match)}?`} variant="danger" size="sm">
            <Trash2 className="h-4 w-4" />
            Elimina
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
