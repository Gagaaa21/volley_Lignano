import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Pencil, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { formatDateShort } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deletePhysicalTestAction } from "./actions";

export const metadata: Metadata = {
  title: "Test fisici",
};

export default async function PhysicalTestsPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const [tests, athletes] = await Promise.all([
    repo.listPhysicalTests({ team }),
    repo.listAthletes({ team }),
  ]);
  const athleteById = new Map(athletes.map((a) => [a.id, a] as const));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Activity className="h-6 w-6 text-primary" />
            Test fisici
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Risultati dei test fisici (es. altezza di salto) assegnati a ciascuna atleta, per confrontarli nel
            tempo.
          </p>
        </div>
        {athletes.length > 0 && (
          <LinkButton href="/admin/test-fisici/nuovo">
            <Plus className="h-4 w-4" />
            Nuovo test
          </LinkButton>
        )}
      </div>

      {athletes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Serve prima un&apos;atleta in anagrafica.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungine una
          </Link>
          , poi torna qui per registrare il primo test.
        </div>
      ) : tests.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun test registrato ancora. Aggiungi il primo per iniziare a tracciare i risultati nel tempo.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tests.map((test) => {
            const athlete = athleteById.get(test.athleteId);
            return (
              <Card key={test.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {formatDateShort(test.date)}
                      </span>
                      <p className="truncate font-semibold text-foreground">{test.testName}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {athlete ? (
                        <Link
                          href={`/admin/test-fisici/atleta/${athlete.id}`}
                          className="font-medium text-foreground/80 hover:text-primary hover:underline"
                        >
                          {athlete.fullName}
                        </Link>
                      ) : (
                        "Atleta eliminata"
                      )}{" "}
                      · {test.value}
                    </p>
                    {test.notes && <p className="mt-1 truncate text-sm text-muted-foreground">{test.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <LinkButton
                      href={`/admin/test-fisici/${test.id}`}
                      variant="outline"
                      size="sm"
                      aria-label="Modifica"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </LinkButton>
                    <form action={deletePhysicalTestAction}>
                      <input type="hidden" name="id" value={test.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Eliminare il test "${test.testName}" del ${formatDateShort(test.date)}?`}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/8"
                      >
                        Elimina
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
