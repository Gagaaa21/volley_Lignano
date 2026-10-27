import type { Metadata } from "next";
import { Binoculars, ChartNoAxesColumn, FileDown, Pencil } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import { deriveScout } from "@/lib/scout/derive";
import { effectiveLevel, LEVEL_META } from "@/lib/scout/levels";
import { summarizeScout } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import type { MatchScout } from "@/lib/scout/types";
import { ScoutSetupNeeded } from "@/components/scout/ScoutSetupNeeded";
import { requireScoutMatch } from "@/lib/scout/server";
import { computeStats, percent } from "@/lib/scout/stats";
import { ReceptionBars, ReceptionTiles, ReceptionZones, SideOutByGrade } from "@/components/scout/ScoutDetail";
import { ErrorsTable, FlowChart, HowComparison } from "@/components/scout/ScoutTables";
import { TabellinoSheet } from "@/components/scout/TabellinoSheet";
import { buildSheet } from "@/lib/scout/sheet";
import { SectionTour } from "@/components/tour/SectionTour";
import { getScoutTabellinoTourSteps } from "@/components/tour/scoutSteps";
import { ScoutLineups } from "@/components/scout/ScoutLineups";
import { lineupSummary } from "@/lib/scout/court";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { FileLink } from "@/components/files/FileLink";
import { buttonVariants } from "@/components/ui/button-variants";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";

export const metadata: Metadata = {
  title: "Tabellino",
};

export default async function ScoutTabellinoPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ set?: string }>;
}) {
  const { matchId } = await params;
  const { set: setParam } = await searchParams;
  const { session, repo, match } = await requireScoutMatch(matchId);
  let scout: MatchScout | null;
  try {
    scout = await repo.getMatchScout(matchId);
  } catch (error) {
    if (!isScoutTableMissing(error)) throw error;
    return <ScoutSetupNeeded isDev={session.role === "dev"} />;
  }
  const summary = summarizeScout(scout);

  // Il livello con cui si è segnata la partita decide quali sezioni e colonne ci sono (e quindi i passi della guida).
  const level = scout ? effectiveLevel(scout) : "base";
  const view = scout && summary.state !== "none" ? deriveScout(scout) : null;
  const played = view ? view.sets.filter((set) => set.rallies.length > 0) : [];
  const requested = Number(setParam);
  const selected = played.some((set) => set.n === requested) ? requested : null;
  const stats = scout && view ? computeStats(view, scout.roster, { set: selected }) : null;
  const showReception = level !== "base" && Boolean(stats && stats.analysis.us.receptions > 0);
  const lineups = view && scout ? lineupSummary(view, scout.roster, selected) : null;
  const showLineups = Boolean(lineups && (lineups.starts.length > 0 || lineups.subs.length > 0));

  // Il PDF è il foglio del tabellino, sempre su tutta la partita (il set scelto vale solo per le analisi in pagina).
  const pdfHref = `/api/scout/${matchId}/pdf`;
  const header = (
    <PageHeader
      back={{ href: "/admin/scout", label: "Scout" }}
      eyebrow={
        <span className="inline-flex flex-wrap items-center gap-2">
          <CategoryTag category={match.category} size="md" long />
          <span>
            {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
          </span>
        </span>
      }
      title={`Tabellino ${matchTitle(match)}`}
      description={match.location}
      help={
        summary.state !== "none" ? (
          <SectionTour steps={getScoutTabellinoTourSteps(matchId, { level, reception: showReception, lineups: showLineups })} />
        ) : undefined
      }
      actions={
        <>
          <LinkButton href={`/admin/scout/${matchId}`} variant="outline">
            <Pencil className="h-4 w-4" />
            {summary.state === "done" ? "Rivedi i punti" : "Segna i punti"}
          </LinkButton>
          {summary.state !== "none" && (
            <FileLink
              href={pdfHref}
              className={buttonVariants({ variant: "outline" })}
              sheetTitle={`Tabellino ${matchTitle(match)}`}
              data-scout-pdf
              data-tour="scout-tab-pdf"
            >
              <FileDown className="h-4 w-4" />
              Scarica PDF
            </FileLink>
          )}
        </>
      }
    />
  );

  if (!scout || !view || !stats || summary.state === "none") {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <EmptyState
          icon={Binoculars}
          title="Ancora nessun punto segnato"
          description="Il tabellino si compila da solo mentre segni i punti della partita."
          action={
            <LinkButton href={`/admin/scout/${matchId}`}>
              <Pencil className="h-4 w-4" />
              Comincia a segnare
            </LinkButton>
          }
        />
      </div>
    );
  }

  const { us, opp } = stats;

  const over = summary.state === "done";
  // Il tabellino come quelli delle leghe: sempre su tutta la partita, con i set riga per riga.
  const sheet = buildSheet(scout, view);

  // Il risultato inserito in «Partite» e quello dello scout dovrebbero coincidere.
  const scoutPartials = played.map((set) => `${set.score.us}-${set.score.opp}`).join(" ");
  const officialPartials = (match.setScores ?? []).map((s) => `${s.us}-${s.them}`).join(" ");
  const differs = over && officialPartials !== "" && officialPartials !== scoutPartials;

  const setLabel = selected ? `${selected}° set` : "tutta la partita";

  return (
    <div className="mx-auto max-w-6xl">
      {header}

      <div className="space-y-8">
        {differs && (
          <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground" data-scout-differs>
            I parziali inseriti in <b>Partite</b> ({officialPartials.replaceAll(" ", " · ")}) sono diversi da quelli dello scout ({scoutPartials.replaceAll(" ", " · ")}).
            Controlla quale dei due è giusto.
          </p>
        )}

        <TabellinoSheet sheet={sheet} match={match} over={over} />

        <div className="space-y-1 border-t border-border pt-6">
          <h2 className="font-display text-xl font-extrabold text-foreground">Analisi della partita</h2>
          <p className="text-sm text-muted-foreground">Break point, come si è fatto punto, errori, andamento e (con i livelli più alti) ricezione, zone e rotazioni: per tutta la partita o per un set.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3" data-tour="scout-tab-sets">
          <SegmentedLinks
            ariaLabel="Set da mostrare"
            items={[
              { href: `/admin/scout/${matchId}/tabellino`, label: "Tutta la partita", active: selected === null },
              ...played.map((set) => ({
                href: `/admin/scout/${matchId}/tabellino?set=${set.n}`,
                label: `${set.n}° set`,
                active: selected === set.n,
              })),
            ]}
          />
          <Badge tone="neutral" className="px-3 py-1">
            {stats.rallies} scambi · {setLabel}
          </Badge>
          <Badge tone={level === "base" ? "neutral" : "primary"} className="px-3 py-1" data-scout-level-badge={level}>
            Livello {LEVEL_META[level].label}
          </Badge>
        </div>

        <section aria-label="Break point e cambio palla" className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="scout-tab-bp">
          <StatTile
            label="Punti in battuta (break point)"
            value={`${percent(us.breakPoints, us.served) ?? 0}%`}
            hint={`${us.breakPoints} su ${us.served} · loro ${percent(opp.breakPoints, opp.served) ?? 0}%`}
            icon={ChartNoAxesColumn}
          />
          <StatTile
            label="Cambio palla (side-out)"
            value={`${percent(us.sideOuts, us.received) ?? 0}%`}
            hint={`${us.sideOuts} su ${us.received} · loro ${percent(opp.sideOuts, opp.received) ?? 0}%`}
            icon={ChartNoAxesColumn}
            tone="gold"
          />
          <StatTile label="Serie di punti più lunga" value={us.longestRun} hint={`loro ${opp.longestRun}`} tone="success" />
          <StatTile label="Errori commessi" value={us.errors} hint={`loro ${opp.errors}`} tone="warning" />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-tour="scout-tab-how">
            <CardHeader className="pb-3">
              <CardTitle>Come si è fatto punto</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">I punti di ognuna delle due squadre, divisi per come sono arrivati.</p>
            </CardHeader>
            <CardBody>
              <HowComparison us={us} opp={opp} />
            </CardBody>
          </Card>
          <Card data-tour="scout-tab-errors">
            <CardHeader className="pb-3">
              <CardTitle>Errori e falli</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ogni errore o fallo è un punto per l&apos;altra squadra.</p>
            </CardHeader>
            <CardBody>
              <ErrorsTable us={us} opp={opp} />
            </CardBody>
          </Card>
        </div>

        <Card data-tour="scout-tab-flow">
          <CardHeader className="pb-3">
            <CardTitle>Andamento del punteggio</CardTitle>
          </CardHeader>
          <CardBody>
            <FlowChart sets={stats.sets.filter((set) => selected === null || set.n === selected)} />
          </CardBody>
        </Card>

        {level !== "base" && !showReception && (
          <p role="status" className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground" data-scout-no-reception>
            Questa partita è a livello <b className="text-foreground">{LEVEL_META[level].label}</b>, ma {selected ? "in questo set" : "finora"} non è stata segnata nessuna ricezione.
            Le troverai qui quando le segni mentre batte l&apos;avversaria.
          </p>
        )}

        {showReception && (
          <Card data-tour="scout-tab-reception" data-scout-reception-card>
            <CardHeader className="pb-3">
              <CardTitle>La ricezione</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Com&apos;è andata ogni ricezione della nostra squadra, con il voto che hai segnato (# perfetta, + positiva, ! neutra, − negativa, / scarsa, = errore).
              </p>
            </CardHeader>
            <CardBody className="space-y-6">
              <ReceptionTiles analysis={stats.analysis.us} />
              <ReceptionBars analysis={stats.analysis.us} players={stats.players.us} />
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-display text-base font-bold text-foreground">Il cambio palla dipende dalla ricezione</h3>
                  <p className="mb-3 text-sm text-muted-foreground">Dopo una ricezione di quel voto, quante volte abbiamo vinto lo scambio e preso la battuta.</p>
                  <SideOutByGrade analysis={stats.analysis.us} />
                </div>
                <ReceptionZones analysis={stats.analysis.us} />
              </div>
            </CardBody>
          </Card>
        )}

        {lineups && <ScoutLineups {...lineups} opponent={match.opponent} />}

      </div>
    </div>
  );
}
