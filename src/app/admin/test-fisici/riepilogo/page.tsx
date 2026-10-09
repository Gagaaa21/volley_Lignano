import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { CATEGORY_LABELS, MINIVOLLEY_GROUP_LABELS } from "@/lib/category";
import { buildAthleteSessions } from "@/lib/physicalTestOverview";
import type { PhysicalTest } from "@/lib/types";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestFisiciTabs } from "../TestFisiciTabs";
import { RiepilogoTable, type OverviewAthlete } from "./RiepilogoTable";

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

  const testsByAthlete = new Map<string, PhysicalTest[]>();
  for (const test of tests) {
    const list = testsByAthlete.get(test.athleteId);
    if (list) list.push(test);
    else testsByAthlete.set(test.athleteId, [test]);
  }

  const overview: OverviewAthlete[] = athletes
    .map((athlete) => ({
      id: athlete.id,
      fullName: athlete.fullName,
      isActive: athlete.isActive,
      label: athlete.category
        ? CATEGORY_LABELS[athlete.category]
        : athlete.group
          ? MINIVOLLEY_GROUP_LABELS[athlete.group]
          : null,
      tone: athlete.category === "U14" ? ("u14" as const) : athlete.category === "U15" ? ("u15" as const) : ("neutral" as const),
      sessions: buildAthleteSessions(testsByAthlete.get(athlete.id) ?? []),
    }))
    // Un'atleta non più attiva resta solo se ha dei dati da mostrare.
    .filter((athlete) => athlete.isActive || athlete.sessions.length > 0)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));

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
