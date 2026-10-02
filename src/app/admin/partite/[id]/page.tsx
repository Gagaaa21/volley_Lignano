import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { matchTitle } from "@/lib/calendar";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { CATEGORY_LABELS, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { deleteMatchAction } from "../actions";
import { MatchForm } from "../MatchForm";
import { MatchWorkspace } from "../MatchWorkspace";

export const metadata: Metadata = {
  title: "Modifica partita",
};

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  if (!match) notFound();
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
        eyebrow={match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL}
        title={matchTitle(match)}
        description={`${formatDateLong(match.matchDate.slice(0, 10))} · ${match.matchDate.slice(11, 16)} · ${match.location}`}
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
          <p className="mt-0.5 text-[13px] text-muted-foreground">Sparisce dal calendario insieme a convocazioni e formazioni.</p>
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
