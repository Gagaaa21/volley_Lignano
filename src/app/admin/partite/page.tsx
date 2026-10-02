import type { Metadata } from "next";
import { Download, Plus, Swords } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { CATEGORY_LABELS } from "@/lib/category";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <PageHeader
        title="Partite"
        description={isU14U15 ? "Campionato e amichevoli di Under 14 e Under 15." : "Squadra Minivolley."}
        help={<SectionTour steps={SECTION_PARTITE_STEPS} />}
        actions={
          <>
            <LinkButton href="/api/partite/csv" variant="outline">
              <Download className="h-4 w-4" />
              Esporta CSV
            </LinkButton>
            <LinkButton href="/admin/partite/nuovo" data-tour="section-partite-new">
              <Plus className="h-4 w-4" />
              Nuova partita
            </LinkButton>
          </>
        }
      />

      {isU14U15 && (
        <div className="mb-6 w-fit" data-tour="section-partite-filter">
          <SegmentedLinks
            ariaLabel="Filtra per categoria"
            items={(["all", "U14", "U15"] as const).map((value) => ({
              href: value === "all" ? "/admin/partite" : `/admin/partite?cat=${value}`,
              label: value === "all" ? "Tutte" : CATEGORY_LABELS[value],
              active: activeCategory === value,
            }))}
          />
        </div>
      )}

      {matches.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nessuna partita in programma"
          description="Aggiungi la prima partita: comparirà subito nel calendario pubblico."
          action={
            <LinkButton href="/admin/partite/nuovo">
              <Plus className="h-4 w-4" />
              Nuova partita
            </LinkButton>
          }
        />
      ) : (
        <MatchList matches={matches} />
      )}
    </div>
  );
}
