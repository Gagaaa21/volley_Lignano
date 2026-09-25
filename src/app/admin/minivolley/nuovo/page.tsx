import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TrainingForm } from "../../allenamenti/TrainingForm";

export const metadata: Metadata = {
  title: "Nuovo · Minivolley",
};

export default async function NewMinivolleyPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const isTournament = type === "torneo";

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/minivolley" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna a Minivolley
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">
        {isTournament ? "Nuovo torneo" : "Nuovo allenamento"}
      </h1>
      <p className="mt-1 text-sm text-foreground/60">Squadra Minivolley.</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <TrainingForm team="minivolley" allowTournament defaultIsTournament={isTournament} />
        </CardBody>
      </Card>
    </div>
  );
}
