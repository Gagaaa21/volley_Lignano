import type { Metadata } from "next";
import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Binoculars, BookOpen, ChartNoAxesColumn, FileDown, MapPin, Pencil } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS } from "@/lib/category";
import { todayIso } from "@/lib/today";
import { isScoutable, summarizeScout, type ScoutSummary } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import type { MatchScout } from "@/lib/scout/types";
import { ScoutSetupNeeded } from "@/components/scout/ScoutSetupNeeded";
import { aggregateSeason, percent } from "@/lib/scout/stats";
import { HowComparison, PlayerTable } from "@/components/scout/ScoutTables";
import { SectionTour } from "@/components/tour/SectionTour";
import { getScoutHubTourSteps } from "@/components/tour/scoutSteps";
import { ScoutWelcome } from "@/components/scout/ScoutWelcome";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";
import type { Match } from "@/lib/types";

export const metadata: Metadata = {
  title: "Scout",
};

function StatusBadge({ summary }: { summary: ScoutSummary }) {
  if (summary.state === "none") return <Badge tone="neutral">Da segnare</Badge>;
  if (summary.state === "done") {
    return (
      <Badge tone={summary.setsWon.us > summary.setsWon.opp ? "success" : "danger"}>
        Concluso {summary.setsWon.us}–{summary.setsWon.opp}
      </Badge>
    );
  }
  return (
    <Badge tone="warning">
      In corso{summary.lastSet ? ` · ${summary.lastSet.n}° set ${summary.lastSet.score.us}–${summary.lastSet.score.opp}` : ""}
    </Badge>
  );
}

function MatchRow({ match, summary, first }: { match: Match; summary: ScoutSummary; first: boolean }) {
  const date = parseISO(match.matchDate.slice(0, 10));
  const action: ReactNode =
    summary.state === "none" ? (
      <LinkButton href={`/admin/scout/${match.id}`} size="sm" data-scout-open={match.id}>
        <Binoculars className="h-3.5 w-3.5" />
        Segna i punti
      </LinkButton>
    ) : (
      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/admin/scout/${match.id}/tabellino`} size="sm" variant={summary.state === "done" ? "primary" : "outline"} data-scout-tabellino={match.id}>
          <ChartNoAxesColumn className="h-3.5 w-3.5" />
          Tabellino
        </LinkButton>
        <LinkButton href={`/admin/scout/${match.id}`} size="sm" variant={summary.state === "live" ? "primary" : "outline"} data-scout-open={match.id}>
          <Pencil className="h-3.5 w-3.5" />
          {summary.state === "live" ? "Continua" : "Rivedi"}
        </LinkButton>
        <LinkButton href={`/api/scout/${match.id}/pdf`} size="sm" variant="quiet" aria-label="Scarica il tabellino in PDF" title="Scarica il tabellino in PDF">
          <FileDown className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only">PDF</span>
        </LinkButton>
      </div>
    );

  return (
    <div className="flex flex-col px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5" data-scout-match={match.id}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="w-11 shrink-0 text-center">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{format(date, "EEE", { locale: it })}</span>
          <span className="display-wide tabular block text-[1.375rem] leading-7 text-foreground">{format(date, "d")}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{format(date, "MMM", { locale: it })}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold text-foreground">{matchTitle(match)}</span>
            {match.category && <Badge tone={match.category === "U14" ? "u14" : "u15"}>{CATEGORY_LABELS[match.category]}</Badge>}
            {match.isFriendly && <Badge tone="neutral">Amichevole</Badge>}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="tabular shrink-0 font-semibold text-foreground/75">{match.matchDate.slice(11, 16)}</span>
            <MapPin className="ml-1 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{match.location}</span>
          </p>
          <div className="mt-1.5">
            <StatusBadge summary={summary} />
          </div>
        </div>
      </div>
      <div className="mt-2.5 pl-[3.75rem] sm:mt-0 sm:pl-0" data-tour={first ? "scout-hub-action" : undefined}>
        {action}
      </div>
    </div>
  );
}

export default async function ScoutHubPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireStaffPage("scout");
  const { vista } = await searchParams;
  const season = vista === "stagione";

  const repo = await getActiveRepo();
  let allMatches: Match[];
  let scouts: MatchScout[];
  try {
    [allMatches, scouts] = await Promise.all([repo.listMatches({ team: "u14u15" }), repo.listMatchScouts()]);
  } catch (error) {
    // La tabella dello scout non è ancora stata creata su Supabase: si spiega cosa fare invece di una pagina d'errore.
    if (!isScoutTableMissing(error)) throw error;
    return (
      <div>
        <PageHeader title="Scout" description="Segna punto per punto chi fa punto e come: ne esce il tabellino della partita." />
        <ScoutSetupNeeded isDev={session.role === "dev"} />
      </div>
    );
  }
  const matches = allMatches.filter(isScoutable);
  const scoutByMatch = new Map(scouts.map((scout) => [scout.matchId, scout]));

  const today = todayIso();
  const upcoming = matches.filter((m) => m.matchDate.slice(0, 10) >= today).sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const played = matches.filter((m) => m.matchDate.slice(0, 10) < today).sort((a, b) => b.matchDate.localeCompare(a.matchDate));

  const tabs = (
    <div className="mb-6 w-fit" data-tour="section-scout-tabs">
      <SegmentedLinks
        ariaLabel="Vista"
        items={[
          { href: "/admin/scout", label: "Partite", active: !season },
          { href: "/admin/scout?vista=stagione", label: "Stagione", active: season },
        ]}
      />
    </div>
  );

  const header = (
    <PageHeader
      title="Scout"
      description="Segna punto per punto chi fa punto e come: ne esce il tabellino della partita, con i numeri di ogni giocatrice."
      help={<SectionTour steps={getScoutHubTourSteps({ showMatches: !season && matches.length > 0, season })} />}
      actions={
        <LinkButton href="/api/scout/manuale" variant="outline" data-tour="scout-manual" data-scout-manual-link>
          <BookOpen className="h-4 w-4" />
          Manuale d&apos;uso (PDF)
        </LinkButton>
      }
    />
  );

  // La guida passo passo parte su una partita vera: la prossima ancora da segnare, altrimenti la prima in elenco.
  const guideMatch =
    [...upcoming, ...played].find((m) => summarizeScout(scoutByMatch.get(m.id) ?? null).state !== "done") ?? upcoming[0] ?? played[0] ?? null;
  const welcome = <ScoutWelcome guideHref={guideMatch ? `/admin/scout/${guideMatch.id}?guida=1` : null} />;

  if (season) {
    // Le partite scoutizzate della stagione, dalla più vecchia: il nome di una giocatrice è quello dell'ultima partita.
    const dated = matches
      .filter((m) => scoutByMatch.has(m.id))
      .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
      .map((m) => scoutByMatch.get(m.id)!);
    const stats = aggregateSeason(dated);
    const matchesByPlayer = new Map(stats.players.map((p) => [p.id, p.matches]));

    return (
      <div>
        {header}
        {welcome}
        {tabs}
        {stats.matches === 0 ? (
          <EmptyState
            icon={Binoculars}
            title="Nessuna partita scoutizzata"
            description="Quando avrai segnato i punti di qualche partita, qui troverai i totali della stagione e i numeri di ogni giocatrice."
          />
        ) : (
          <div className="space-y-8">
            <section aria-label="Totali della stagione" className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-scout-season data-tour="scout-season-totals">
              <StatTile label="Partite scoutizzate" value={stats.matches} hint={`${stats.rallies} scambi`} icon={Binoculars} />
              <StatTile label="Punti fatti" value={stats.us.points} hint={`loro ${stats.opp.points}`} icon={ChartNoAxesColumn} tone="gold" />
              <StatTile
                label="Punti in battuta (break point)"
                value={`${percent(stats.us.breakPoints, stats.us.served) ?? 0}%`}
                hint={`loro ${percent(stats.opp.breakPoints, stats.opp.served) ?? 0}%`}
                tone="success"
              />
              <StatTile
                label="Cambio palla (side-out)"
                value={`${percent(stats.us.sideOuts, stats.us.received) ?? 0}%`}
                hint={`loro ${percent(stats.opp.sideOuts, stats.opp.received) ?? 0}%`}
                tone="warning"
              />
            </section>

            <Card data-tour="scout-season-how">
              <CardHeader className="pb-3">
                <CardTitle>Come facciamo punto, in stagione</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">La somma di tutte le partite scoutizzate, noi contro le avversarie.</p>
              </CardHeader>
              <CardBody>
                <HowComparison us={stats.us} opp={stats.opp} />
              </CardBody>
            </Card>

            <div data-tour="scout-season-players">
              <PlayerTable side="us" players={stats.players} title="Le nostre giocatrici" matches={matchesByPlayer} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const firstId = (upcoming[0] ?? played[0])?.id;
  const rows = (list: Match[]) =>
    list.map((match) => (
      <MatchRow key={match.id} match={match} summary={summarizeScout(scoutByMatch.get(match.id) ?? null)} first={match.id === firstId} />
    ));

  return (
    <div>
      {header}
      {welcome}
      {tabs}
      {matches.length === 0 ? (
        <EmptyState
          icon={Binoculars}
          title="Nessuna partita"
          description="Lo scout si fa su una partita del calendario (campionato o amichevole). Aggiungine una dalla sezione Partite."
          action={
            <LinkButton href="/admin/partite/nuovo" variant="outline">
              Nuova partita
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-9" data-tour="section-scout-matches">
          {upcoming.length > 0 && (
            <section>
              <SectionHeading title="Oggi e prossime partite" />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">{rows(upcoming)}</div>
            </section>
          )}
          {played.length > 0 && (
            <section>
              <SectionHeading title="Partite giocate" />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">{rows(played)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
