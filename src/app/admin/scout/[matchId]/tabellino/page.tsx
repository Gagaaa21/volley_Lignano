import type { Metadata } from "next";
import { Binoculars, ChartNoAxesColumn, FileDown, Pencil } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import { deriveScout } from "@/lib/scout/derive";
import { footnoteFor, legendFor } from "@/lib/scout/legend";
import { effectiveLevel, LEVEL_META } from "@/lib/scout/levels";
import { summarizeScout } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import type { MatchScout } from "@/lib/scout/types";
import { ScoutSetupNeeded } from "@/components/scout/ScoutSetupNeeded";
import { requireScoutMatch } from "@/lib/scout/server";
import { computeStats, emptyZones, percent, zonedTouches } from "@/lib/scout/stats";
import { ReceptionBars, ReceptionTiles, RotationsTable, SideOutByGrade, ZoneMaps } from "@/components/scout/ScoutDetail";
import { ErrorsTable, FlowChart, HowComparison, PlayerTable } from "@/components/scout/ScoutTables";
import { SectionTour } from "@/components/tour/SectionTour";
import { getScoutTabellinoTourSteps } from "@/components/tour/scoutSteps";
import { ScoutLineups } from "@/components/scout/ScoutLineups";
import { lineupSummary } from "@/lib/scout/court";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { SharePdfButton } from "@/components/pdf/SharePdfButton";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { StatTile } from "@/components/ui/StatTile";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Tabellino",
};

function minutesLabel(minutes: number): string {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}'` : `${minutes}'`;
}

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
  const showZones = level === "completo" && Boolean(stats && (zonedTouches(stats.analysis.us.zones.dig) > 0 || zonedTouches(stats.analysis.us.zones.attack) > 0));
  const showRotations = level === "completo" && Boolean(stats && stats.analysis.us.rotations.some((r) => r.served + r.received > 0));
  const lineups = view && scout ? lineupSummary(view, scout.roster, selected) : null;
  const showLineups = Boolean(lineups && (lineups.starts.length > 0 || lineups.subs.length > 0));

  const pdfHref = `/api/scout/${matchId}/pdf${setParam ? `?set=${encodeURIComponent(setParam)}` : ""}`;
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
          <SectionTour steps={getScoutTabellinoTourSteps(matchId, { level, reception: showReception, zones: showZones, rotations: showRotations, lineups: showLineups })} />
        ) : undefined
      }
      actions={
        <>
          <LinkButton href={`/admin/scout/${matchId}`} variant="outline">
            <Pencil className="h-4 w-4" />
            {summary.state === "done" ? "Rivedi i punti" : "Segna i punti"}
          </LinkButton>
          {summary.state !== "none" && (
            <LinkButton
              href={pdfHref}
              variant="outline"
              data-scout-pdf
              data-tour="scout-tab-pdf"
            >
              <FileDown className="h-4 w-4" />
              Scarica PDF
            </LinkButton>
          )}
          {summary.state !== "none" && (
            <SharePdfButton href={pdfHref} title={`Tabellino ${matchTitle(match)}`} prefetch data-share-pdf="tabellino" />
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
  const result = view.setsWon;
  const totalMinutes = stats.sets.every((set) => set.rallies === 0 || set.minutes !== null)
    ? stats.sets.reduce((sum, set) => sum + (set.minutes ?? 0), 0)
    : null;

  // Il risultato inserito in «Partite» e quello dello scout dovrebbero coincidere.
  const scoutPartials = played.map((set) => `${set.score.us}-${set.score.opp}`).join(" ");
  const officialPartials = (match.setScores ?? []).map((s) => `${s.us}-${s.them}`).join(" ");
  const differs = over && officialPartials !== "" && officialPartials !== scoutPartials;

  const setLabel = selected ? `${selected}° set` : "tutta la partita";

  return (
    <div className="mx-auto max-w-5xl">
      {header}

      <div className="space-y-8">
        <section
          aria-label="Risultato"
          data-scout-result
          data-tour="scout-tab-result"
          className="overflow-hidden rounded-2xl bg-sea-950 p-5 text-white shadow-[0_14px_32px_-20px_rgba(12,30,42,0.7)] ring-1 ring-sea-950/10 sm:p-6"
        >
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
            {over ? "Risultato dello scout" : "Partita in corso (risultato provvisorio)"}
            {over && result.us !== result.opp && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] tracking-[0.08em]",
                  result.us > result.opp ? "bg-green-400/20 text-green-300" : "bg-red-400/20 text-red-300",
                )}
                data-scout-outcome
              >
                {result.us > result.opp ? "Vittoria" : "Sconfitta"}
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <p className="tabular flex items-baseline gap-3 font-display text-6xl font-extrabold leading-none sm:text-7xl">
              <span data-scout-result-us>{result.us}</span>
              <span aria-hidden className="text-4xl font-bold text-white/30">
                –
              </span>
              <span data-scout-result-opp>{result.opp}</span>
              <span className="ml-1 text-base font-bold text-white/60">set</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {played.map((set) => {
                const summaryOfSet = stats.sets.find((s) => s.n === set.n);
                return (
                  <span
                    key={set.n}
                    className={cn(
                      "tabular rounded-full px-3 py-1.5 text-sm font-bold",
                      set.winner === "us" ? "bg-sea-500/35 text-white" : set.winner === "opp" ? "bg-sand-400/30 text-white" : "bg-white/10 text-white/80",
                    )}
                  >
                    <span className="mr-1.5 text-xs font-semibold text-white/60">{set.n}°</span>
                    {set.score.us}–{set.score.opp}
                    {summaryOfSet?.minutes ? <span className="ml-2 text-xs font-medium text-white/55">{summaryOfSet.minutes} min</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
          <p className="mt-3 text-xs text-white/55">
            Calcolato dai punti segnati con lo scout: non è il risultato ufficiale.
            {over ? "" : " La partita non è ancora conclusa."}
            {totalMinutes ? ` Durata stimata: ${minutesLabel(totalMinutes)}.` : ""}
          </p>
        </section>

        {differs && (
          <p role="status" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground" data-scout-differs>
            I parziali inseriti in <b>Partite</b> ({officialPartials.replaceAll(" ", " · ")}) sono diversi da quelli dello scout ({scoutPartials.replaceAll(" ", " · ")}).
            Controlla quale dei due è giusto.
          </p>
        )}

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
                <ZoneMaps analysis={{ ...stats.analysis.us, zones: { ...stats.analysis.us.zones, dig: emptyZones(), attack: emptyZones() } }} full={false} />
              </div>
            </CardBody>
          </Card>
        )}

        {level === "completo" && (
          <>
            {showZones && (
              <Card data-tour="scout-tab-zones" data-scout-zones-card>
                <CardHeader className="pb-3">
                  <CardTitle>Le mappe del campo</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Dove abbiamo difeso e da dove abbiamo attaccato, nelle zone che hai segnato.</p>
                </CardHeader>
                <CardBody>
                  <ZoneMaps
                    analysis={{ ...stats.analysis.us, zones: { ...stats.analysis.us.zones, reception: emptyZones() } }}
                    full
                  />
                </CardBody>
              </Card>
            )}
            <Card data-tour="scout-tab-rotations" data-scout-rotations-card>
              <CardHeader className="pb-3">
                <CardTitle>Le rotazioni</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Break point e cambio palla in ogni rotazione. La 1ª è quella con cui si comincia il set; si passa alla successiva ogni volta che la squadra recupera la
                  battuta.
                </p>
              </CardHeader>
              <CardBody>
                <div className="grid gap-5 lg:grid-cols-2">
                  <RotationsTable analysis={stats.analysis.us} title="Volley Lignano" />
                  <RotationsTable analysis={stats.analysis.opp} title={match.opponent} />
                </div>
              </CardBody>
            </Card>
          </>
        )}

        {lineups && <ScoutLineups {...lineups} opponent={match.opponent} />}

        <div className="space-y-6" data-tour="scout-tab-players">
          <PlayerTable side="us" players={stats.players.us} title="Volley Lignano" level={level} />
          <PlayerTable side="opp" players={stats.players.opp} title={match.opponent} level={level} />
        </div>

        <Card className="bg-surface-muted/60 shadow-none" data-tour="scout-tab-legend">
          <CardHeader className="pb-2">
            <CardTitle>Come leggere il tabellino</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
              {legendFor(level).map(([term, text]) => (
                <div key={term}>
                  <dt className="inline font-bold text-foreground">{term}: </dt>
                  <dd className="inline text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {footnoteFor(level)} Le durate dei set sono stimate dall&apos;ora in cui sono stati segnati il primo tocco o punto e l&apos;ultimo punto.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
