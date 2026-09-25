import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireStaff, activeTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
  const team = activeTeam(session);
  const isTournament = team === "minivolley" && type === "torneo";

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/allenamenti" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna agli allenamenti
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">
        {isTournament ? "Nuovo torneo" : "Nuovo allenamento"}
      </h1>
      <p className="mt-1 text-sm text-foreground/60">
        {team === "minivolley"
          ? "Squadra Minivolley."
          : "Imposta i giorni della settimana in cui si ripete l'allenamento."}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <TrainingForm
            team={team}
            allowTournament={team === "minivolley"}
            defaultIsTournament={isTournament}
          />
        </CardBody>
      </Card>
    </div>
  );
}
