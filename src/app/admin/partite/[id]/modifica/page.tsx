import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { Card, CardBody } from "@/components/ui/Card";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { deleteMatchAction } from "../../actions";
import { MatchForm } from "../../MatchForm";

export const metadata: Metadata = {
  title: "Modifica partita",
};

/**
 * I dettagli di una partita in un modulo a parte (dalla scheda, «Modifica»): chi gioca, quando e dove, il ritrovo e la nota,
 * con l'anteprima della notifica che partirà. Il risultato e le convocazioni restano nella scheda; l'eliminazione è qui in fondo.
 */
export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const repo = await getActiveRepo();
  const match = await repo.getMatch(id);
  if (!match) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: `/admin/partite/${match.id}`, label: "Torna alla partita" }}
        eyebrow={match.category ? <CategoryTag category={match.category} size="md" long /> : MATCH_NO_CATEGORY_LABEL}
        title={`Modifica ${matchTitle(match)}`}
        description="Chi gioca, quando e dove. Il risultato e le convocazioni si cambiano dalla scheda della partita."
      />

      <Card>
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
