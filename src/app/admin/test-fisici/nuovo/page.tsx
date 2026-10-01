import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PhysicalTestForm } from "../PhysicalTestForm";

export const metadata: Metadata = {
  title: "Nuovo test fisico",
};

export default async function NewPhysicalTestPage({
  searchParams,
}: {
  searchParams: Promise<{ athleteId?: string }>;
}) {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const { athleteId } = await searchParams;
  const repo = await getActiveRepo();
  const [athletes, tests] = await Promise.all([
    repo.listAthletes({ team }),
    repo.listPhysicalTests({ team }),
  ]);
  const testNameSuggestions = [...new Set(tests.map((t) => t.testName))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/test-fisici" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna ai test fisici
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuovo test fisico</h1>
      <p className="mt-1 text-sm text-muted-foreground">Registra il risultato di un test assegnato a un&apos;atleta.</p>

      {athletes.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Serve prima un&apos;atleta in anagrafica.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungine una
          </Link>
          .
        </div>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
          </CardHeader>
          <CardBody>
            <PhysicalTestForm athletes={athletes} testNameSuggestions={testNameSuggestions} defaultAthleteId={athleteId} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
