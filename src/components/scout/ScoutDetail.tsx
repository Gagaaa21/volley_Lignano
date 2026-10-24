import { cn } from "@/lib/cn";
import { GRADE_FILL, GradeBar, GradeDot, GradeLegend, totalOf } from "@/components/scout/GradeChart";
import { ZoneMap } from "@/components/scout/ZoneMap";
import { StatTile } from "@/components/ui/StatTile";
import { percent, zonedTouches, type PlayerStats, type SideAnalysis } from "@/lib/scout/stats";
import { gradeSymbol, TOUCH_SKILLS } from "@/lib/scout/touches";
import { SCOUT_GRADES, type ScoutGrade } from "@/lib/scout/types";

/**
 * Le parti del tabellino che esistono solo col livello «Con ricezioni»: la
 * ricezione (voti, zone, cambio palla). Senza stato: servono anche alla pagina
 * della stagione.
 */

const RECEPTION_NAMES: Partial<Record<ScoutGrade, string>> = TOUCH_SKILLS.reception.gradeLabels;
/** Per il cambio palla non serve l'errore: lo scambio è perso per definizione. */
const SIDE_OUT_GRADES: ScoutGrade[] = ["#", "+", "!", "-", "/"];

function ratio(part: number, total: number): string {
  return `${part} su ${total}`;
}

/** Quanto è positiva e quanto perfetta la ricezione, e gli errori: i numeri che si guardano per primi. */
export function ReceptionTiles({ analysis }: { analysis: SideAnalysis }) {
  const total = analysis.receptions;
  const good = analysis.reception["#"] + analysis.reception["+"];
  const sideOuts = SIDE_OUT_GRADES.reduce((n, g) => n + analysis.sideOutByGrade[g].won, 0);
  const received = SCOUT_GRADES.reduce((n, g) => n + analysis.sideOutByGrade[g].total, 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-scout-reception-tiles>
      <StatTile label="Ricezione positiva" value={`${percent(good, total) ?? 0}%`} hint={`${ratio(good, total)} ricezioni (# e +)`} tone="success" />
      <StatTile label="Ricezione perfetta" value={`${percent(analysis.reception["#"], total) ?? 0}%`} hint={`${ratio(analysis.reception["#"], total)} ricezioni`} />
      <StatTile label="Errori in ricezione" value={analysis.reception["="]} hint={`${percent(analysis.reception["="], total) ?? 0}% delle ricezioni`} tone="warning" />
      <StatTile
        label="Cambio palla dopo la ricezione"
        value={`${percent(sideOuts, received) ?? 0}%`}
        hint={`${ratio(sideOuts, received)} scambi vinti`}
        tone="gold"
      />
    </div>
  );
}

/** Come è andata la ricezione: la barra della squadra e una per ogni giocatrice che ha ricevuto. */
export function ReceptionBars({ analysis, players }: { analysis: SideAnalysis; players: PlayerStats[] }) {
  const receivers = players.filter((p) => p.detail.receptions > 0).sort((a, b) => b.detail.receptions - a.detail.receptions);
  return (
    <div className="space-y-4" data-scout-reception-bars>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-foreground">Tutta la squadra</p>
        <GradeBar counts={analysis.reception} label="Squadra" size="lg" />
      </div>
      <GradeLegend names={RECEPTION_NAMES} />
      <ul className="space-y-2.5" aria-label="Ricezione per giocatrice">
        {receivers.map((p) => {
          const total = totalOf(p.detail.reception);
          const good = p.detail.reception["#"] + p.detail.reception["+"];
          return (
            <li key={p.id} className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr_13rem]" data-scout-reception-row={p.id}>
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                <span className="tabular mr-1.5 text-muted-foreground">{p.number ?? "–"}</span>
                {p.name}
              </span>
              <GradeBar counts={p.detail.reception} label={p.name} size="md" />
              <span className="tabular col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:text-right">
                <b className="text-foreground">{total}</b> ric. · pos {percent(good, total)}% · prf {percent(p.detail.reception["#"], total)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Per ogni voto della ricezione, quante volte lo scambio è stato poi vinto: la prova che la ricezione si allena. */
export function SideOutByGrade({ analysis }: { analysis: SideAnalysis }) {
  const rows = SIDE_OUT_GRADES.filter((g) => analysis.sideOutByGrade[g].total > 0);
  if (rows.length === 0) return null;
  const best = analysis.sideOutByGrade["#"];
  const worst = (["-", "/"] as const).reduce(
    (acc, g) => ({ total: acc.total + analysis.sideOutByGrade[g].total, won: acc.won + analysis.sideOutByGrade[g].won }),
    { total: 0, won: 0 },
  );
  return (
    <div data-scout-sideout-grade>
      <ul className="space-y-2">
        {rows.map((g) => {
          const cell = analysis.sideOutByGrade[g];
          const value = percent(cell.won, cell.total) ?? 0;
          return (
            <li key={g} className="grid grid-cols-[1.5rem_5.5rem_1fr_5.5rem] items-center gap-x-2 text-sm">
              <GradeDot grade={g} size="sm" />
              <span className="font-medium text-foreground">{RECEPTION_NAMES[g]}</span>
              <span
                className="h-2.5 overflow-hidden rounded-full bg-muted"
                title={`Dopo una ricezione ${RECEPTION_NAMES[g]?.toLowerCase()} (${gradeSymbol(g)}): scambio vinto ${cell.won} volte su ${cell.total}`}
              >
                <span className={cn("block h-full rounded-full", GRADE_FILL[g])} style={{ width: `${value}%` }} />
              </span>
              <span className="tabular text-right text-xs text-muted-foreground">
                <b className="text-foreground">{value}%</b> {cell.won}/{cell.total}
              </span>
            </li>
          );
        })}
      </ul>
      {best.total > 0 && worst.total > 0 && (
        <p className="mt-3 rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
          Dopo una ricezione perfetta lo scambio è vinto il <b>{percent(best.won, best.total)}%</b> delle volte, dopo una negativa o scarsa il{" "}
          <b>{percent(worst.won, worst.total)}%</b>.
        </p>
      )}
    </div>
  );
}

/** La mappa delle zone di ricezione, se in qualche ricezione si è segnata la zona. */
export function ReceptionZones({ analysis }: { analysis: SideAnalysis }) {
  if (zonedTouches(analysis.zones.reception) === 0) return null;
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-8 gap-y-6" data-scout-zone-maps>
      <ZoneMap grid={analysis.zones.reception} title="Dove si riceve" goodLabel="positivi (# e +)" lostLabel="scarsi o errori" />
    </div>
  );
}
