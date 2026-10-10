import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { buildOverviewAthletes } from "@/lib/physicalTestTable";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestFisiciTabs } from "../TestFisiciTabs";
import { RiepilogoTable } from "./RiepilogoTable";

export const metadata: Metadata = {
  title: "Riepilogo test fisici",
};

export default async function PhysicalTestsOverviewPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const [tests, athletes] = await Promise.all([
    repo.listPhysicalTests({ team }),
    repo.listAthletes({ team }),
  ]);

  const overview = buildOverviewAthletes(tests, athletes);

  const hasData = overview.some((athlete) => athlete.sessions.length > 0);

  return (
    <div>
      <PageHeader
        title="Test fisici"
        description="Tutti i risultati di tutte le atlete in una tabella: confronta, ordina e scarica senza aprire un'atleta alla volta."
        actions={
          athletes.length > 0 ? (
            <LinkButton href="/admin/test-fisici/nuovo">
              <Plus className="h-4 w-4" />
              Nuovo test
            </LinkButton>
          ) : undefined
        }
      />
      <TestFisiciTabs active="riepilogo" />

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun test registrato ancora.{" "}
          {athletes.length > 0 ? (
            <Link href="/admin/test-fisici/nuovo" className="font-semibold text-primary hover:underline">
              Registra il primo
            </Link>
          ) : (
            <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
              Aggiungi prima un&apos;atleta
            </Link>
          )}
          .
        </div>
      ) : (
        <RiepilogoTable athletes={overview} />
      )}
    </div>
  );
}
