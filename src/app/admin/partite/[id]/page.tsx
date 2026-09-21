import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldHalf } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { MatchForm } from "../MatchForm";
import { LineupEditor } from "../LineupEditor";

export const metadata: Metadata = {
  title: "Modifica partita",
};

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const [match, allAthletes, lineup] = await Promise.all([
    repo.getMatch(id),
    repo.listAthletes(),
    repo.getMatchLineup(id),
  ]);
  if (!match) notFound();

  const activeAthletes = allAthletes.filter((a) => a.isActive);
  const calledUpAthletes = activeAthletes.filter((a) => match.calledUpAthleteIds.includes(a.id));

  return (
    <div className="mx-auto max-w-3xl">
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
          <MatchForm match={match} athletes={activeAthletes} />
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <ShieldHalf className="h-4 w-4 text-sea-700" />
            Formazioni per set
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            Visibili solo allo staff dell&apos;area riservata: mai sul sito pubblico. Tocca una
            posizione in campo per assegnare giocatrice, ruolo e capitana.
          </p>
        </CardHeader>
        <CardBody>
          {calledUpAthletes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-foreground/50">
              Seleziona prima le convocate nella sezione &quot;Dettagli&quot; qui sopra per poter
              costruire le formazioni.
            </div>
          ) : (
            <LineupEditor matchId={id} athletes={calledUpAthletes} initialLineup={lineup} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
