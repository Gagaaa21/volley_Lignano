import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deleteAthleteAction } from "../actions";
import { AthleteForm } from "../AthleteForm";

export const metadata: Metadata = {
  title: "Modifica atleta",
};

export default async function EditAthletePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(id);
  if (!athlete) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/admin/presenze/atlete", label: "Atlete" }}
        eyebrow="Modifica atleta"
        title={athlete.fullName}
      />

      <Card>
        <CardBody className="pt-6">
          <AthleteForm athlete={athlete} team={athlete.team} />
        </CardBody>
      </Card>

      <section className="mt-8 flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Elimina atleta</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Le presenze già registrate restano, ma senza nome collegato.
          </p>
        </div>
        <form action={deleteAthleteAction}>
          <input type="hidden" name="id" value={athlete.id} />
          <ConfirmSubmitButton
            confirmMessage={`Eliminare definitivamente ${athlete.fullName}? Le presenze registrate resteranno ma senza nome collegato.`}
            variant="danger"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
