import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";
import {
  getBodyMeasureHistory,
  groupSquatJumpSessions,
  isBodyMeasureField,
  isSquatJumpField,
} from "@/lib/physicalTestFields";

export const metadata: Metadata = {
  title: "Test fisici atleta",
};

function Delta({ current, previous, unit }: { current: number; previous: number; unit: string }) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/40">
        <Minus className="h-3 w-3" />
        invariato
      </span>
    );
  }
  const up = diff > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        up ? "text-[var(--color-u14-strong)]" : "text-destructive",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {diff.toFixed(2)} {unit}
    </span>
  );
}

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

  const bodyMeasures = getBodyMeasureHistory(tests);
  const squatJumpSessions = groupSquatJumpSessions(tests);

  // Tutto il resto ("Altro" nel form di inserimento), raggruppato per nome
  // del test in ordine cronologico crescente, così il confronto nel tempo
  // per lo stesso dato si legge da sinistra a destra come un'evoluzione.
  const otherTests = tests.filter((t) => !isSquatJumpField(t.testName) && !isBodyMeasureField(t.testName));
  const otherGroups = new Map<string, typeof otherTests>();
  for (const test of otherTests) {
    const group = otherGroups.get(test.testName);
    if (group) group.push(test);
    else otherGroups.set(test.testName, [test]);
  }
  for (const group of otherGroups.values()) group.sort((a, b) => a.date.localeCompare(b.date));

  const hasAnyData = bodyMeasures.some((m) => m.latest) || squatJumpSessions.length > 0 || otherGroups.size > 0;

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

      {!hasAnyData ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun test registrato ancora per {athlete.fullName}.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {bodyMeasures.some((m) => m.latest) && (
            <div>
              <p className="eyebrow">Misure corporee</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {bodyMeasures
                  .filter((m) => m.latest)
                  .map((measure) => (
                    <Card key={measure.key}>
                      <CardBody className="pt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                          {measure.label}
                        </p>
                        <p className="mt-1 font-display text-2xl font-bold text-foreground">
                          {measure.latest!.value}
                          <span className="ml-1 text-sm font-normal text-foreground/50">{measure.unit}</span>
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs text-foreground/40">{formatDateShort(measure.latest!.date)}</span>
                          {measure.previous &&
                            Number.isFinite(Number(measure.latest!.value)) &&
                            Number.isFinite(Number(measure.previous.value)) && (
                              <Delta
                                current={Number(measure.latest!.value)}
                                previous={Number(measure.previous.value)}
                                unit={measure.unit}
                              />
                            )}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {squatJumpSessions.length > 0 && (
            <div>
              <p className="eyebrow">Squat Jump</p>
              <div className="mt-3 space-y-3">
                {squatJumpSessions.map((session, i) => {
                  const previous = squatJumpSessions[i + 1];
                  return (
                    <Card key={session.date}>
                      <CardBody className="pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {formatDateShort(session.date)}
                          </span>
                          {previous?.meanAltezza != null && session.meanAltezza != null && (
                            <Delta current={session.meanAltezza} previous={previous.meanAltezza} unit="cm" />
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-[auto_1fr_1fr_1fr] gap-x-3 gap-y-1.5 text-sm">
                          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
                            Salto
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
                            Tempo di volo
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
                            Altezza
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
                            Forza
                          </span>
                          {session.trials.map((trial) => (
                            <Fragment key={trial.trial}>
                              <span className="text-foreground/60">{trial.trial}</span>
                              <span className="font-medium text-foreground">
                                {trial.tempo ? `${trial.tempo} ms` : "—"}
                              </span>
                              <span className="font-medium text-foreground">
                                {trial.altezza ? `${trial.altezza} cm` : "—"}
                              </span>
                              <span className="font-medium text-foreground">
                                {trial.forza ? `${trial.forza} N` : "—"}
                              </span>
                            </Fragment>
                          ))}
                          <span className="font-semibold text-primary">Media</span>
                          <span className="font-semibold text-primary">
                            {session.meanTempo != null ? `${session.meanTempo.toFixed(2)} ms` : "—"}
                          </span>
                          <span className="font-semibold text-primary">
                            {session.meanAltezza != null ? `${session.meanAltezza.toFixed(2)} cm` : "—"}
                          </span>
                          <span className="font-semibold text-primary">
                            {session.meanForza != null ? `${session.meanForza.toFixed(2)} N` : "—"}
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {[...otherGroups.entries()].map(([testName, entries]) => (
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
