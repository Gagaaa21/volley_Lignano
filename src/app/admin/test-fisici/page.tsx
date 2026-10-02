import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Activity className="h-6 w-6 text-primary" />
            Test fisici
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Risultati dei test fisici (es. Squat Jump, misure corporee) per atleta, per confrontarli nel tempo.
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
      ) : (
        <div className="mt-6">
          <TestFisiciHome athletes={summaries} />
        </div>
      )}
    </div>
  );
}
