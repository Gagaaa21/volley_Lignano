import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_PARTITE_STEPS } from "@/components/tour/sectionSteps";
import type { Category } from "@/lib/types";
import { MatchList } from "./MatchList";

export const metadata: Metadata = {
  title: "Partite",
};

export default async function MatchesListPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const isU14U15 = team === "u14u15";
  const activeCategory: "all" | Category = isU14U15 && (cat === "U14" || cat === "U15") ? cat : "all";

  const repo = await getActiveRepo();
  const matches = await repo.listMatches({
    team,
    category: activeCategory === "all" ? undefined : activeCategory,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Partite</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {isU14U15 ? "Gestisci le partite di campionato per Under 14 e Under 15." : "Squadra Minivolley."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SectionTour steps={SECTION_PARTITE_STEPS} />
          <LinkButton href="/api/partite/csv" variant="outline">
            <Download className="h-4 w-4" />
            Esporta CSV
          </LinkButton>
          <LinkButton href="/admin/partite/nuovo" data-tour="section-partite-new">
            <Plus className="h-4 w-4" />
            Nuova partita
          </LinkButton>
        </div>
      </div>

      {isU14U15 && (
        <div
          className="mt-5 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-sm shadow-sea-950/5"
          data-tour="section-partite-filter"
        >
          {(["all", "U14", "U15"] as const).map((value) => (
            <Link
              key={value}
              href={value === "all" ? "/admin/partite" : `/admin/partite?cat=${value}`}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                activeCategory === value
                  ? "bg-sea-700 text-white shadow-sm"
                  : "text-foreground/60 hover:bg-surface-muted",
              )}
            >
              {value === "all" ? "Tutte" : CATEGORY_LABELS[value]}
            </Link>
          ))}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna partita in programma.
        </div>
      ) : (
        <MatchList matches={matches} />
      )}
    </div>
  );
}
