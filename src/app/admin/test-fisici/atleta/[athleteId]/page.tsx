import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, Minus, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { List, ListItem } from "@/components/ui/List";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { AthleteAvatar } from "../../AthleteAvatar";
import {
  getBodyMeasureHistory,
  groupSquatJumpSessions,
  isBodyMeasureField,
  isSquatJumpField,
} from "@/lib/physicalTestFields";
import { deletePhysicalTestAction, deleteSquatJumpSessionAction } from "../../actions";

export const metadata: Metadata = {
  title: "Test fisici atleta",
};

function sessionEditHref(athleteId: string, date: string) {
  return `/admin/test-fisici/atleta/${athleteId}/sessione/${date}`;
}

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

  // Una sessione è un giorno con almeno un dato: da qui si apre il modulo
  // di inserimento già compilato per correggerla (anche misure e salti
  // vecchi, che nelle schede qui sotto non si vedono più).
  const sessionDates = [...new Set(tests.map((t) => t.date))].sort((a, b) => b.localeCompare(a));
  const sessionSummaries = sessionDates.map((date) => {
    const rows = tests.filter((t) => t.date === date);
    const jumps = rows.filter((t) => isSquatJumpField(t.testName)).length;
    const measures = rows.filter((t) => isBodyMeasureField(t.testName)).length;
    const others = rows.length - jumps - measures;
    const parts = [
      jumps > 0 && "Squat Jump",
      measures > 0 && `${measures} ${measures === 1 ? "misura" : "misure"}`,
      others > 0 && `${others} ${others === 1 ? "altro dato" : "altri dati"}`,
    ].filter(Boolean);
    return { date, summary: parts.join(" · ") };
  });

  const hasAnyData = bodyMeasures.some((m) => m.latest) || squatJumpSessions.length > 0 || otherGroups.size > 0;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/test-fisici", label: "Test fisici" }}
        title={
          <span className="flex items-center gap-3">
            <AthleteAvatar fullName={athlete.fullName} />
            <span className="min-w-0">{athlete.fullName}</span>
          </span>
        }
        description="Storico dei test fisici registrati."
        actions={
          <LinkButton href={`/admin/test-fisici/nuovo/${athlete.id}`}>
            <Plus className="h-4 w-4" />
            Nuovo test
          </LinkButton>
        }
      />

      {!hasAnyData ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun test registrato ancora per {athlete.fullName}.
        </div>
      ) : (
        <div className="space-y-9">
          {bodyMeasures.some((m) => m.latest) && (
            <div>
              <p className="eyebrow">Misure corporee</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {bodyMeasures
                  .filter((m) => m.latest)
                  .map((measure) => (
                    <Card key={measure.key}>
                      <CardBody className="pt-5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                            {measure.label}
                          </p>
                          <Link
                            href={sessionEditHref(athlete.id, measure.latest!.date)}
                            aria-label={`Modifica la sessione del ${formatDateShort(measure.latest!.date)}`}
                            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-foreground/30 hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </div>
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
                          <div className="flex items-center gap-1.5">
                            {previous?.meanAltezza != null && session.meanAltezza != null && (
                              <Delta current={session.meanAltezza} previous={previous.meanAltezza} unit="cm" />
                            )}
                            <Link
                              href={sessionEditHref(athlete.id, session.date)}
                              aria-label={`Modifica la sessione del ${formatDateShort(session.date)}`}
                              className="rounded-full p-1.5 text-foreground/30 hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <form action={deleteSquatJumpSessionAction}>
                              <input type="hidden" name="athleteId" value={athleteId} />
                              <input type="hidden" name="date" value={session.date} />
                              <ConfirmSubmitButton
                                confirmMessage={`Eliminare la sessione Squat Jump del ${formatDateShort(session.date)}?`}
                                variant="ghost"
                                size="sm"
                                aria-label="Elimina sessione"
                                className="-mr-2 aspect-square !px-0 text-destructive hover:bg-destructive/8"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </ConfirmSubmitButton>
                            </form>
                          </div>
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
                    <CardBody className="flex items-center justify-between gap-3 pt-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground/60">
                            {formatDateShort(test.date)}
                          </span>
                          <span className="font-semibold text-foreground">{test.value}</span>
                        </div>
                        {test.notes && <p className="mt-1.5 text-sm text-muted-foreground">{test.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          href={`/admin/test-fisici/${test.id}`}
                          aria-label="Modifica"
                          className="rounded-full p-1.5 text-foreground/30 hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <form action={deletePhysicalTestAction}>
                          <input type="hidden" name="id" value={test.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Eliminare "${test.testName}" del ${formatDateShort(test.date)}?`}
                            variant="ghost"
                            size="sm"
                            aria-label="Elimina"
                            className="aspect-square !px-0 text-destructive hover:bg-destructive/8"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="eyebrow">Sessioni registrate</p>
            <p className="mt-1 text-sm text-muted-foreground">Tocca una sessione per correggerne i dati o la data.</p>
            <List className="mt-3">
              {sessionSummaries.map(({ date, summary }) => (
                <ListItem key={date} href={sessionEditHref(athlete.id, date)}>
                  <span className="icon-chip shrink-0">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">{formatDateShort(date)}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{summary}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                    Modifica
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </ListItem>
              ))}
            </List>
          </div>
        </div>
      )}
    </div>
  );
}
