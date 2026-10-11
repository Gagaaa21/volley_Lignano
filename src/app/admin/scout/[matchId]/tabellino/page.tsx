import type { Metadata } from "next";
import { Binoculars, ChartNoAxesColumn, FileDown, Pencil } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatDateLong } from "@/lib/format";
import { deriveScout } from "@/lib/scout/derive";
import { summarizeScout } from "@/lib/scout/match";
import { isScoutTableMissing } from "@/lib/scout/missing";
import type { MatchScout } from "@/lib/scout/types";
import { ScoutSetupNeeded } from "@/components/scout/ScoutSetupNeeded";
import { requireScoutMatch } from "@/lib/scout/server";
import { computeStats, percent } from "@/lib/scout/stats";
import { ErrorsTable, FlowChart, HowComparison, PlayerTable } from "@/components/scout/ScoutTables";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
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

  const header = (
    <PageHeader
      back={{ href: "/admin/scout", label: "Scout" }}
      eyebrow={
        <span>
          {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
          {match.category ? ` · ${CATEGORY_LABELS[match.category]}` : ""}
        </span>
      }
      title={`Tabellino ${matchTitle(match)}`}
      description={match.location}
      actions={
        <>
          <LinkButton href={`/admin/scout/${matchId}`} variant="outline">
            <Pencil className="h-4 w-4" />
            {summary.state === "done" ? "Rivedi i punti" : "Segna i punti"}
          </LinkButton>
          {summary.state !== "none" && (
            <LinkButton href={`/api/scout/${matchId}/pdf${setParam ? `?set=${encodeURIComponent(setParam)}` : ""}`} variant="outline" data-scout-pdf>
              <FileDown className="h-4 w-4" />
              Scarica PDF
            </LinkButton>
          )}
        </>
      }
    />
  );

  if (!scout || summary.state === "none") {
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

  const view = deriveScout(scout);
  const played = view.sets.filter((set) => set.rallies.length > 0);
  const requested = Number(setParam);
  const selected = played.some((set) => set.n === requested) ? requested : null;
  const stats = computeStats(view, scout.roster, { set: selected });
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

        <div className="flex flex-wrap items-center gap-3">
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
        </div>

        <section aria-label="Break point e cambio palla" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Come si è fatto punto</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">I punti di ognuna delle due squadre, divisi per come sono arrivati.</p>
            </CardHeader>
            <CardBody>
              <HowComparison us={us} opp={opp} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Errori e falli</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Ogni errore o fallo è un punto per l&apos;altra squadra.</p>
            </CardHeader>
            <CardBody>
              <ErrorsTable us={us} opp={opp} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Andamento del punteggio</CardTitle>
          </CardHeader>
          <CardBody>
            <FlowChart sets={stats.sets.filter((set) => selected === null || set.n === selected)} />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <PlayerTable side="us" players={stats.players.us} title="Volley Lignano" />
          <PlayerTable side="opp" players={stats.players.opp} title={match.opponent} />
        </div>

        <Card className="bg-surface-muted/60 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle>Come leggere il tabellino</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
              {[
                ["Tot", "Punti fatti: attacchi vincenti, muri e ace."],
                ["BP", "Di quei punti, quelli fatti mentre la propria squadra batteva (break point)."],
                ["V‑P", "Punti fatti meno gli errori e gli attacchi murati."],
                ["Ace / Err", "Battute vincenti e battute sbagliate."],
                ["Ricez. Err", "Ricezioni sbagliate: la palla è toccata e finisce fuori o a terra. Se cade senza essere toccata è un ace di chi batte."],
                ["Attacco", "Attacchi vincenti (Pt), sbagliati (Err) e fermati dal muro avversario (Mur)."],
                ["Muro", "Muri vincenti (Pt) ed errori a muro (Err)."],
                ["Altri", "Alzate e difese sbagliate e falli fischiati attribuiti a una giocatrice."],
              ].map(([term, text]) => (
                <div key={term}>
                  <dt className="inline font-bold text-foreground">{term}: </dt>
                  <dd className="inline text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Lo scout segna come finisce ogni scambio (chi fa punto e come), non ogni singolo tocco: per questo mancano attacchi tentati, ricezioni totali e le
              percentuali di attacco e di ricezione dei tabellini di Lega. Le durate dei set sono stimate dall&apos;ora in cui sono stati segnati il primo e
              l&apos;ultimo punto.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
