import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Test fisici atleta",
};

export default async function AthletePhysicalTestsPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  await requireStaff();
  const { athleteId } = await params;
  const repo = await getActiveRepo();
  const athlete = await repo.getAthlete(athleteId);
  if (!athlete) notFound();

  const tests = (await repo.listPhysicalTests({ team: athlete.team })).filter(
    (t) => t.athleteId === athleteId,
  );

  // Raggruppati per nome del test, ognuno in ordine cronologico crescente,
  // così il confronto nel tempo per lo stesso test si legge da sinistra a
  // destra come un'evoluzione invece che come un elenco sparso.
  const groups = new Map<string, typeof tests>();
  for (const test of tests) {
    const group = groups.get(test.testName);
    if (group) group.push(test);
    else groups.set(test.testName, [test]);
  }
  for (const group of groups.values()) group.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <LinkButton href="/admin/test-fisici" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna ai test fisici
      </LinkButton>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{athlete.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Storico dei test fisici registrati.</p>
        </div>
        <LinkButton href={`/admin/test-fisici/nuovo/${athlete.id}`}>
          <Plus className="h-4 w-4" />
          Nuovo test
        </LinkButton>
      </div>

      {groups.size === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun test registrato ancora per {athlete.fullName}.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([testName, entries]) => (
            <div key={testName}>
              <p className="eyebrow">{testName}</p>
              <div className="mt-3 space-y-2">
                {entries.map((test) => (
                  <Card key={test.id}>
                    <CardBody className="pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground/60">{formatDateShort(test.date)}</span>
                        <span className="font-semibold text-foreground">{test.value}</span>
                      </div>
                      {test.notes && <p className="mt-1.5 text-sm text-muted-foreground">{test.notes}</p>}
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
