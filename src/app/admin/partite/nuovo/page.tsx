import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MatchForm } from "../MatchForm";

export const metadata: Metadata = {
  title: "Nuova partita",
};

export default async function NewMatchPage() {
  const repo = await getRepo();
  const athletes = (await repo.listAthletes()).filter((a) => a.isActive);

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/partite" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle partite
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuova partita</h1>
      <p className="mt-1 text-sm text-foreground/60">Aggiungi una partita al calendario pubblico.</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <MatchForm athletes={athletes} />
        </CardBody>
      </Card>
    </div>
  );
}
