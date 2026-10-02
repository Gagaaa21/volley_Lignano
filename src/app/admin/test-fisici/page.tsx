import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestFisiciHome, type AthleteTestSummary } from "./TestFisiciHome";

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

  const testsByAthlete = new Map<string, { dates: Set<string>; lastDate: string | null }>();
  for (const test of tests) {
    const entry = testsByAthlete.get(test.athleteId) ?? { dates: new Set<string>(), lastDate: null };
    entry.dates.add(test.date);
    if (!entry.lastDate || test.date > entry.lastDate) entry.lastDate = test.date;
    testsByAthlete.set(test.athleteId, entry);
  }

  const summaries: AthleteTestSummary[] = athletes
    .map((athlete) => {
      const entry = testsByAthlete.get(athlete.id);
      return {
        id: athlete.id,
        fullName: athlete.fullName,
        sessionCount: entry?.dates.size ?? 0,
        lastDate: entry?.lastDate ?? null,
      };
    })
    .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || a.fullName.localeCompare(b.fullName));

  return (
    <div>
      <PageHeader
        title="Test fisici"
        description="Squat Jump, misure corporee e altri test per atleta, da confrontare nel tempo."
        actions={
          athletes.length > 0 ? (
            <LinkButton href="/admin/test-fisici/nuovo">
              <Plus className="h-4 w-4" />
              Nuovo test
            </LinkButton>
          ) : undefined
        }
      />

      {athletes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Serve prima un&apos;atleta in anagrafica.{" "}
          <Link href="/admin/presenze/atlete/nuova" className="font-semibold text-primary hover:underline">
            Aggiungine una
          </Link>
          , poi torna qui per registrare il primo test.
        </div>
      ) : (
        <TestFisiciHome athletes={summaries} />
      )}
    </div>
  );
}
