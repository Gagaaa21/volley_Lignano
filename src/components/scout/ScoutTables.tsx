import { cn } from "@/lib/cn";
import { ERROR_HOWS, HOW_META } from "@/lib/scout/rules";
import { columnsFor, formatPercent, signedNumber, totalOf, type Column, type Row } from "@/lib/scout/columns";
import { hasActivity, pointsFromErrors, type PlayerStats, type SetSummary, type TeamStats } from "@/lib/scout/stats";
import type { ScoutLevel, ScoutSide } from "@/lib/scout/types";

/**
 * Le parti del tabellino, senza stato: si usano nella pagina del tabellino e
 * si leggono bene anche stampate. A livello Base le colonne sono quelle del
 * tabellino di Lega che uno scout «a punto» sa riempire davvero; coi livelli
 * «Con ricezioni» e «Completo», che segnano anche i tocchi, si aggiungono la
 * ricezione (totali, positiva %, perfetta %) e, nel Completo, battute, attacchi
 * (punto %, efficienza) e difese. Le colonne cambiano da sole col livello.
 */

function Cell({ value, strong, tone }: { value: number; strong?: boolean; tone?: "plus" | "minus" }) {
  if (value === 0 && !strong) return <span className="text-muted-foreground/45">–</span>;
  return (
    <span
      className={cn(
        strong && "font-bold text-foreground",
        tone === "plus" && value > 0 && "font-semibold text-success",
        tone === "minus" && value > 0 && "font-semibold text-destructive",
      )}
    >
      {value}
    </span>
  );
}

const th = "px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground";
const group = "border-l border-border px-2 pt-2 text-center text-[10px] font-extrabold uppercase tracking-[0.1em] text-foreground/70";
const td = "px-2 py-2 text-center";
const sep = "border-l border-border";

function ColumnCell({ column, row, total }: { column: Column; row: Row; total?: boolean }) {
  const value = column.value(row);
  const base = cn(td, column.sep && sep);
  if (column.kind === "pct" || column.kind === "eff") {
    return <td className={cn(base, total && "font-bold")}>{value === null ? <span className="text-muted-foreground/45">–</span> : formatPercent(value, column.kind === "eff")}</td>;
  }
  const n = value ?? 0;
  if (column.kind === "balance") {
    return <td className={cn(base, n > 0 && "font-semibold text-success", n < 0 && "font-semibold text-destructive")}>{signedNumber(n)}</td>;
  }
  if (total) return <td className={base}>{n}</td>;
  return (
    <td className={base}>
      <Cell value={n} strong={column.kind === "strong"} tone={column.kind === "minus" ? "minus" : undefined} />
    </td>
  );
}

/** Il tabellino di una squadra: una riga per giocatrice con almeno un'azione, e la riga del totale. */
export function PlayerTable({
  side,
  players,
  title,
  matches,
  level = "base",
}: {
  side: ScoutSide;
  players: PlayerStats[];
  title: string;
  /** Per la stagione: in quante partite ha giocato ognuna (colonna «Part.»). */
  matches?: Map<string, number>;
  /** Quali colonne mostrare: dal livello della partita. */
  level?: ScoutLevel;
}) {
  const active = players.filter(hasActivity);
  const idle = players.filter((p) => !hasActivity(p));
  const total = totalOf(players);
  const columns = columnsFor(level);
  const groups: { name: string; span: number }[] = [];
  for (const column of columns) {
    const last = groups[groups.length - 1];
    if (last && last.name === column.group) last.span += 1;
    else groups.push({ name: column.group, span: 1 });
  }
  const minWidth = level === "completo" ? "min-w-[74rem]" : level === "ricezioni" ? "min-w-[54rem]" : "min-w-[46rem]";

  return (
    <section data-scout-table={side} data-scout-level-table={level} aria-label={title}>
      <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-foreground">
        <span className={cn("h-2.5 w-2.5 rounded-full", side === "us" ? "bg-primary" : "bg-sand-400")} />
        {title}
      </h3>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
        <table className={cn("tabular w-full border-collapse text-sm", minWidth)}>
          <thead className="bg-surface-muted">
            <tr>
              <th rowSpan={2} className={cn(th, "sticky left-0 z-10 w-10 min-w-10 bg-surface-muted pl-3 text-left align-bottom")}>
                N°
              </th>
              <th rowSpan={2} className={cn(th, "sticky left-10 z-10 min-w-[8.5rem] bg-surface-muted text-left align-bottom")}>
                Giocatrice
              </th>
              {matches && (
                <th rowSpan={2} className={cn(th, "align-bottom")} title="Partite scoutizzate in cui ha fatto o subìto almeno un'azione">
                  Part.
                </th>
              )}
              {groups.map((g) => (
                <th key={g.name} colSpan={g.span} className={group}>
                  {g.name}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((c, i) => (
                <th key={`${c.group}-${c.label}-${i}`} className={cn(th, c.sep && sep)} title={c.title}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {active.length === 0 && (
              <tr>
                <td colSpan={columns.length + (matches ? 3 : 2)} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nessuna azione segnata{side === "us" ? " per le nostre giocatrici" : " per l'avversaria"}.
                </td>
              </tr>
            )}
            {active.map((p) => (
              <tr key={p.id} data-scout-player-row={p.id} className={cn(p.id === "?" && "text-muted-foreground")}>
                <td className="sticky left-0 z-10 w-10 min-w-10 bg-card py-2 pl-3 pr-2 text-left font-bold text-foreground">{p.number ?? "–"}</td>
                <td className="sticky left-10 z-10 min-w-[8.5rem] max-w-[11rem] truncate bg-card px-2 py-2 text-left font-semibold text-foreground">
                  {p.name}
                  {p.libero && <span className="ml-1.5 rounded bg-accent px-1 text-[10px] font-bold text-accent-foreground">L</span>}
                </td>
                {matches && <td className={td}>{matches.get(p.id) ?? 0}</td>}
                {columns.map((c, i) => (
                  <ColumnCell key={`${c.group}-${c.label}-${i}`} column={c} row={p} />
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border-strong bg-surface-muted font-bold text-foreground">
            <tr data-scout-total={side}>
              <td className="sticky left-0 z-10 bg-surface-muted py-2 pl-3 pr-2 text-left" />
              <td className="sticky left-10 z-10 bg-surface-muted px-2 py-2 text-left">Squadra</td>
              {matches && <td className={td} />}
              {columns.map((c, i) => (
                <ColumnCell key={`${c.group}-${c.label}-${i}`} column={c} row={total} total />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {idle.length > 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Senza azioni segnate: {idle.map((p) => (side === "opp" ? `n. ${p.number ?? p.name}` : p.name)).join(", ")}.
        </p>
      )}
    </section>
  );
}

function BarRow({ label, us, opp, max, strong }: { label: string; us: number; opp: number; max: number; strong?: boolean }) {
  const width = (value: number) => (max === 0 ? 0 : Math.round((value / max) * 100));
  return (
    <div data-scout-how={label}>
      <p className={cn("mb-1 text-center text-xs font-semibold text-muted-foreground", strong && "font-bold text-foreground")}>{label}</p>
      <div className="grid grid-cols-2 gap-0.5">
        <div className="flex items-center gap-2 border-r border-border pr-1">
          <span className={cn("tabular w-7 shrink-0 text-right text-sm", strong ? "font-extrabold text-foreground" : "font-bold text-foreground")}>{us}</span>
          <div className="flex flex-1 justify-end">
            <div className="h-3.5 rounded-l-full bg-primary" style={{ width: `${width(us)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 pl-1">
          <div className="flex flex-1 justify-start">
            <div className="h-3.5 rounded-r-full bg-sand-400" style={{ width: `${width(opp)}%` }} />
          </div>
          <span className={cn("tabular w-7 shrink-0 text-sm", strong ? "font-extrabold text-foreground" : "font-bold text-foreground")}>{opp}</span>
        </div>
      </div>
    </div>
  );
}

/** Come ognuna delle due squadre ha fatto i suoi punti: due barre contrapposte per ogni modo. */
export function HowComparison({ us, opp }: { us: TeamStats; opp: TeamStats }) {
  const usErr = pointsFromErrors(us);
  const oppErr = pointsFromErrors(opp);
  const max = Math.max(us.attack, opp.attack, us.block, opp.block, us.ace, opp.ace, usErr, oppErr, 1);
  return (
    <div className="space-y-3.5" data-scout-how-table>
      <div className="grid grid-cols-2 text-[11px] font-extrabold uppercase tracking-[0.12em]">
        <span className="pr-3 text-right text-primary">Noi</span>
        <span className="pl-3 text-accent-foreground">Loro</span>
      </div>
      <BarRow label="Attacchi vincenti" us={us.attack} opp={opp.attack} max={max} />
      <BarRow label="Muri" us={us.block} opp={opp.block} max={max} />
      <BarRow label="Ace" us={us.ace} opp={opp.ace} max={max} />
      <BarRow label="Errori dell'avversaria" us={usErr} opp={oppErr} max={max} />
      <div className="border-t border-border pt-3.5">
        <BarRow label="Punti totali" us={us.points} opp={opp.points} max={Math.max(us.points, opp.points, 1)} strong />
      </div>
    </div>
  );
}

/** Errori e falli commessi, per tipo: ognuno è un punto per l'altra squadra. */
export function ErrorsTable({ us, opp }: { us: TeamStats; opp: TeamStats }) {
  const rows = ERROR_HOWS.filter((how) => us.committed[how] > 0 || opp.committed[how] > 0);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun errore o fallo segnato.</p>;
  }
  return (
    <table className="tabular w-full text-sm" data-scout-errors-table>
      <thead>
        <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          <th className="py-1.5 text-left">Errore o fallo</th>
          <th className="w-14 py-1.5 text-center text-primary">Noi</th>
          <th className="w-14 py-1.5 text-center text-accent-foreground">Loro</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((how) => (
          <tr key={how}>
            <td className="py-2 font-medium text-foreground">{HOW_META[how].label}</td>
            <td className="py-2 text-center">
              <Cell value={us.committed[how]} strong />
            </td>
            <td className="py-2 text-center">
              <Cell value={opp.committed[how]} strong />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t-2 border-border-strong font-bold text-foreground">
        <tr>
          <td className="py-2">Totale</td>
          <td className="py-2 text-center">{us.errors}</td>
          <td className="py-2 text-center">{opp.errors}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const CHART_W = 640;
const CHART_H = 210;
const PAD_LEFT = 38;
const PAD_RIGHT = 10;
const PAD_TOP = 26;
const PAD_BOTTOM = 10;
const GAP = 3;

/**
 * L'andamento del punteggio: a ogni punto, di quanto è avanti una squadra.
 * Sopra la linea centrale in vantaggio noi, sotto loro; ogni set riparte da
 * zero. Con un solo set scelto occupa tutta la larghezza.
 */
export function FlowChart({ sets }: { sets: SetSummary[] }) {
  const played = sets.filter((set) => set.rallies > 0);
  if (played.length === 0) return null;

  const totalUnits = played.reduce((sum, set) => sum + set.rallies, 0) + GAP * (played.length - 1);
  const maxAbs = Math.max(4, ...played.flatMap((set) => set.flow.map((v) => Math.abs(v))));
  // Un multiplo di 4: anche la riga a metà cade su un numero intero.
  const range = Math.ceil(maxAbs / 4) * 4;
  const innerW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const mid = PAD_TOP + (CHART_H - PAD_TOP - PAD_BOTTOM) / 2;
  const halfH = (CHART_H - PAD_TOP - PAD_BOTTOM) / 2;
  const x = (unit: number) => PAD_LEFT + (unit / totalUnits) * innerW;
  const y = (diff: number) => mid - (diff / range) * halfH;

  // Dove comincia ogni set sull'asse orizzontale: uno dopo l'altro, con un piccolo vuoto in mezzo.
  const starts = played.map((_, i) => played.slice(0, i).reduce((sum, set) => sum + set.rallies + GAP, 0));
  const segments = played.map((set, index) => {
    const start = starts[index];
    const points = set.flow.map((diff, i) => ({ x: x(start + i), y: y(diff) }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const last = points[points.length - 1];
    const area = `${line} L${last.x.toFixed(1)},${mid} L${points[0].x.toFixed(1)},${mid} Z`;
    return { set, line, area, startX: x(start), endX: x(start + set.rallies) };
  });

  const lead = (side: ScoutSide) =>
    Math.max(0, ...played.flatMap((set) => set.flow.map((v) => (side === "us" ? v : -v))));

  return (
    <figure data-scout-flow>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Andamento del punteggio: di quanto è avanti una squadra dopo ogni punto, set per set"
        className="h-auto w-full"
      >
        <defs>
          <clipPath id="scout-flow-up">
            <rect x="0" y="0" width={CHART_W} height={mid} />
          </clipPath>
          <clipPath id="scout-flow-down">
            <rect x="0" y={mid} width={CHART_W} height={CHART_H - mid} />
          </clipPath>
        </defs>

        {[-range, -range / 2, range / 2, range].map((value) => (
          <g key={value}>
            <line x1={PAD_LEFT} x2={CHART_W - PAD_RIGHT} y1={y(value)} y2={y(value)} className="stroke-border" strokeWidth="1" strokeDasharray="3 4" />
            <text x={PAD_LEFT - 8} y={y(value) + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">
              {value > 0 ? `+${value}` : `−${Math.abs(value)}`}
            </text>
          </g>
        ))}
        <text x={PAD_LEFT - 8} y={mid + 4} textAnchor="end" className="fill-muted-foreground" fontSize="11">
          0
        </text>

        {segments.map(({ set, line, area, startX, endX }) => (
          <g key={set.n}>
            <path d={area} clipPath="url(#scout-flow-up)" className="fill-primary/25" />
            <path d={area} clipPath="url(#scout-flow-down)" className="fill-sand-400/40" />
            <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" className="stroke-foreground/75" />
            <text x={(startX + endX) / 2} y={16} textAnchor="middle" className="fill-foreground" fontSize="13" fontWeight="700">
              {set.n}° set
            </text>
          </g>
        ))}

        <line x1={PAD_LEFT} x2={CHART_W - PAD_RIGHT} y1={mid} y2={mid} className="stroke-border-strong" strokeWidth="1.5" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" /> sopra la linea: avanti noi
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-sand-400/60" /> sotto: avanti loro
          </span>
        </span>
        <span>
          Massimo vantaggio: noi <b className="text-foreground">+{lead("us")}</b> · loro <b className="text-foreground">+{lead("opp")}</b>
        </span>
      </figcaption>
    </figure>
  );
}
