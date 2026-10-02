import type { Metadata } from "next";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrainingForm } from "../TrainingForm";

export const metadata: Metadata = {
  title: "Nuovo allenamento",
};

export default async function NewTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const isTournament = team === "minivolley" && type === "torneo";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/allenamenti", label: "Allenamenti" }}
        title={isTournament ? "Nuovo torneo" : "Nuovo allenamento"}
        description={
          team === "minivolley"
            ? "Squadra Minivolley."
            : "Imposta i giorni della settimana in cui si ripete l'allenamento."
        }
      />

      <Card>
        <CardBody className="pt-6 sm:pt-7">
          <TrainingForm team={team} allowTournament={team === "minivolley"} defaultIsTournament={isTournament} />
        </CardBody>
      </Card>
    </div>
  );
}
