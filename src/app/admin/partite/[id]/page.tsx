import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MatchForm } from "../MatchForm";

export const metadata: Metadata = {
  title: "Modifica partita",
};

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const match = await repo.getMatch(id);
  if (!match) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/partite" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle partite
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica partita</h1>
      <p className="mt-1 text-sm text-foreground/60">vs {match.opponent}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <MatchForm match={match} />
        </CardBody>
      </Card>
    </div>
  );
}
