import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Download, FileDown, Link2, Plus, Swords } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { CATEGORY_LABELS } from "@/lib/category";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionTour } from "@/components/tour/SectionTour";
import { loadOfficialResults, officialToAddCount, officialTodoCount, officialTodoParts } from "@/lib/federation/load";
import { scheduleFederationRefresh } from "@/lib/federation/auto";
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
  // Partite e dati del portale in parallelo; senza filtro di categoria le
  // partite sono le stesse che servono al confronto con il portale.
  const matchesPromise = repo.listMatches({
    team,
    category: activeCategory === "all" ? undefined : activeCategory,
  });
  if (isU14U15) scheduleFederationRefresh();
  const [matches, allOfficial] = await Promise.all([
    matchesPromise,
    isU14U15 ? loadOfficialResults(repo, activeCategory === "all" ? matchesPromise : undefined) : Promise.resolve([]),
  ]);
  const official = allOfficial.filter(
    (entry) => entry.source.enabled && entry.source.url && (activeCategory === "all" || entry.source.category === activeCategory),
  );

  // Il riquadro del portale compare solo se almeno una categoria è collegata.
  const showPortal = official.length > 0;
  const portalTodo = officialTodoCount(official);
  const portalToAdd = officialToAddCount(official);
  const portalHref = activeCategory === "all" ? "/admin/partite/portale" : `/admin/partite/portale?cat=${activeCategory}`;

  return (
    <div>
      <PageHeader
        title="Partite"
        description={isU14U15 ? "Campionato e amichevoli di Under 14 e Under 15." : "Squadra Minivolley."}
        help={<SectionTour steps={SECTION_PARTITE_STEPS} />}
        actions={
          <>
            <LinkButton href={activeCategory === "all" ? "/api/partite/pdf" : `/api/partite/pdf?cat=${activeCategory}`} variant="outline">
              <FileDown className="h-4 w-4" />
              Esporta PDF
            </LinkButton>
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
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="w-fit" data-tour="section-partite-filter">
            <SegmentedLinks
              ariaLabel="Filtra per categoria"
              items={(["all", "U14", "U15"] as const).map((value) => ({
                href: value === "all" ? "/admin/partite" : `/admin/partite?cat=${value}`,
                label: value === "all" ? "Tutte" : CATEGORY_LABELS[value],
                active: activeCategory === value,
              }))}
            />
          </div>
        </div>
      )}

      {isU14U15 && showPortal && (
        <Link
          href={portalHref}
          data-tour="section-partite-official"
          data-portal-alert={portalTodo > 0 ? "" : undefined}
          className={
            portalTodo > 0
              ? "group mb-8 flex items-center gap-3.5 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3.5 transition-colors hover:border-warning/50 sm:px-5"
              : "group mb-8 flex items-center gap-3.5 rounded-2xl border border-primary/20 bg-primary-soft/60 px-4 py-3.5 transition-colors hover:border-primary/40 sm:px-5"
          }
        >
          <span
            className={
              portalTodo > 0
                ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning text-white"
                : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
            }
            aria-hidden
          >
            {portalTodo > 0 ? <Link2 className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold text-foreground">Portale FIPAV</span>
            <span className={portalTodo > 0 ? "block text-sm font-semibold text-warning" : "block text-sm text-muted-foreground"}>
              {portalTodo > 0
                ? `Da sistemare: ${officialTodoParts(official).join(" · ")}.`
                : portalToAdd > 0
                  ? `Tutto allineato. ${portalToAdd === 1 ? "1 partita del calendario ufficiale non è" : `${portalToAdd} partite del calendario ufficiale non sono`} ancora nel sito.`
                  : "Tutto allineato con il calendario e i risultati ufficiali."}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      <section aria-labelledby="partite-registrate">
        <div className="mb-1.5 flex items-center gap-3">
          <h2 id="partite-registrate" className="display-wide text-[1.375rem] leading-tight text-foreground">
            Partite registrate
          </h2>
          <Badge tone="neutral">{matches.length}</Badge>
        </div>
        <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
          Sono le partite del calendario del sito, quelle che vedono anche genitori e atlete.
        </p>

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
      </section>

    </div>
  );
}
