import { CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { formatDateLong } from "@/lib/format";
import { LEVEL_META } from "@/lib/scout/levels";
import { perPoint, seasonOf, type AttackSplit, type ScoutSheet, type SheetSetMark, type SheetTeam } from "@/lib/scout/sheet";
import {
  POINTS_WON,
  SHEET_COLUMNS,
  SHEET_LEGEND,
  SHEET_MARKS,
  sheetBalance,
  sheetCount,
  sheetFootnote,
  sheetGroups,
  sheetMinutes,
  sheetScore,
  setMarkLabel,
} from "@/lib/scout/sheetFormat";
import { percent } from "@/lib/scout/stats";
import type { Match } from "@/lib/types";

/**
 * Il tabellino come quello delle leghe (gli scout ufficiali): in alto il campionato, le due squadre con i set vinti, i dati della
 * partita e i set (durata, parziali, finale); poi una tabella per squadra con la rosa, il totale e i punti vinti set per set;
 * in fondo i punti per rotazione, ricezioni e battute per punto, il cambio palla diretto e il contrattacco, e la legenda.
 * I numeri vengono da src/lib/scout/sheet.ts, gli stessi del PDF.
 */

const US_NAME = "Volley Lignano";

/** La gara: campionato, amichevole o torneo. */
function competitionOf(match: Pick<Match, "isFriendly" | "isTournament">): string {
  return match.isTournament ? "Torneo" : match.isFriendly ? "Amichevole" : "Campionato";
}

const th = "px-1 py-1 text-center text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground";
const td = "px-1 py-1 text-center";
const sep = "border-l border-border";

function SetMark({ mark, set }: { mark: SheetSetMark; set: number }) {
  const label = setMarkLabel(mark, set);
  if (mark === null) return <span className="inline-block h-4 w-4" aria-label={label} title={label} />;
  if (mark === "in")
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center" aria-label={label} title={label}>
        <span className="h-2 w-3.5 rounded-[2px] border border-foreground/60" />
      </span>
    );
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-foreground/70 text-[10px] font-bold leading-none text-foreground" aria-label={label} title={label}>
      {mark}
    </span>
  );
}

/** I numeri dei set nell'intestazione: cerchiati quelli in cui la squadra ha battuto per prima. */
function SetNumbers({ count, firstServes }: { count: number; firstServes: number[] }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none", firstServes.includes(n) && "ring-1 ring-foreground/70")}
          title={firstServes.includes(n) ? `${n}° set: ha battuto per prima` : `${n}° set`}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

function TeamTable({ team, name, sets }: { team: SheetTeam; name: string; sets: number }) {
  const groups = sheetGroups();
  const rest = SHEET_COLUMNS.filter((column) => column.group !== "Punti");
  return (
    <section data-scout-table={team.side} aria-label={name} className="border-b border-border">
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[46rem] border-collapse text-[12.5px]">
          <thead className="bg-surface-muted">
            <tr>
              <th colSpan={2} rowSpan={2} className="sticky left-0 z-10 bg-surface-muted px-3 py-1.5 text-left align-bottom">
                <span className="font-display text-[15px] font-extrabold uppercase tracking-[0.01em] text-foreground">{name}</span>
              </th>
              <th className={cn(th, "pb-0")}>Set</th>
              {groups.map((group) => (
                <th key={group.name} colSpan={group.span} className={cn(th, sep, "pb-0 text-[10.5px] font-extrabold text-foreground/75")}>
                  {group.name}
                </th>
              ))}
            </tr>
            <tr>
              <th className={th}>
                <SetNumbers count={sets} firstServes={team.firstServes} />
              </th>
              {SHEET_COLUMNS.map((column) => (
                <th key={column.key} className={cn(th, column.first && sep)} title={column.title}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {team.lines.map((line) => (
              <tr key={line.id} data-scout-player-row={line.id} className={cn(!line.active && "text-muted-foreground", line.id === "?" && "italic text-muted-foreground")}>
                <td className="sticky left-0 z-10 w-12 min-w-12 bg-card pl-3 pr-1 text-left font-bold text-foreground" data-col="numero">
                  {line.number ?? "–"}
                  {line.libero && <span className="ml-1 text-[10px] font-extrabold text-primary">L</span>}
                </td>
                <td className="sticky left-12 z-10 min-w-[8.5rem] max-w-[13rem] truncate bg-card px-1 text-left font-semibold text-foreground" data-col="nome">
                  {line.name}
                </td>
                <td className={td} data-col="set">
                  <span className="inline-flex gap-0.5">
                    {line.sets.map((mark, i) => (
                      <SetMark key={i} mark={mark} set={i + 1} />
                    ))}
                  </span>
                </td>
                {SHEET_COLUMNS.map((column) => (
                  <td key={column.key} className={cn(td, column.first && sep, column.strong && line.active && "font-bold text-foreground")} data-col={column.key}>
                    {column.text(line, team)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tbody>
            <tr data-scout-total={team.side} className="border-t-2 border-foreground/40 bg-surface-muted/60 font-bold">
              <td colSpan={3} className="sticky left-0 z-10 bg-surface-muted px-3 py-1.5 text-left text-[12px] uppercase tracking-[0.04em]">
                Totali giocatrici
              </td>
              {SHEET_COLUMNS.map((column) => (
                <td key={column.key} className={cn(td, column.first && sep)} data-col={column.key}>
                  {column.text(team.total, team)}
                </td>
              ))}
            </tr>
          </tbody>
          <tbody className="text-[12px]">
            <tr className="border-t border-border">
              <td colSpan={2} className="sticky left-0 z-10 bg-card px-3 pt-1.5 text-left text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                Punti vinti
              </td>
              {POINTS_WON.map((item, i) => (
                <td key={item.key} className={cn(th, "pt-1.5", i === 1 && sep)} title={item.title}>
                  {item.label}
                </td>
              ))}
              <td colSpan={rest.length} />
            </tr>
            {team.perSet.map((row) => (
              <tr key={row.n} data-scout-set-row={row.n}>
                <td colSpan={2} className="sticky left-0 z-10 bg-card px-3 py-0.5 text-right font-semibold text-muted-foreground">
                  Set {row.n}
                </td>
                {POINTS_WON.map((item, i) => (
                  <td key={item.key} className={cn(td, "py-0.5", i === 1 && sep)} data-col={`vinti-${item.key}`}>
                    {sheetCount(row.won[item.key])}
                  </td>
                ))}
                {rest.map((column) => (
                  <td key={column.key} className={cn(td, "py-0.5", column.first && sep)} data-col={column.key}>
                    {column.text(row, team)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Le quattro celle di una fase d'attacco; per l'avversaria in ordine inverso, come nei tabellini ufficiali (le due squadre si guardano). */
function splitCells(split: AttackSplit, mirror: boolean): { label: string; value: string }[] {
  const cells = [
    { label: "Err", value: sheetCount(split.errors) },
    { label: "Mur", value: sheetCount(split.blocked) },
    { label: "Punti%", value: split.total ? `${percent(split.kills, split.total)}%` : "." },
    { label: "Tot", value: sheetCount(split.total) },
  ];
  return mirror ? cells.reverse() : cells;
}

/** Il cambio palla diretto (primo attacco dopo la ricezione) e il contrattacco, con le due squadre una di fronte all'altra. */
function AttackPhases({
  us,
  opp,
  oppName,
}: {
  us: NonNullable<SheetTeam["attackPhases"]>;
  opp: NonNullable<SheetTeam["attackPhases"]>;
  oppName: string;
}) {
  const sections: { title: string; rows: { key: "positive" | "negative" | "counter"; label: string | null }[] }[] = [
    {
      title: "Cambio palla diretto",
      rows: [
        { key: "positive", label: "1° attacco dopo ricezione positiva (# +)" },
        { key: "negative", label: "1° attacco dopo ricezione negativa (! - /)" },
      ],
    },
    { title: "Contrattacco", rows: [{ key: "counter", label: null }] },
  ];
  return (
    <div className="overflow-x-auto" data-scout-attack-phases>
      <table className="tabular w-full min-w-[22rem] border-collapse text-[12px]">
        <thead>
          <tr>
            <th colSpan={4} className="truncate px-1.5 pb-1 text-left text-[11px] font-extrabold uppercase text-foreground">
              {US_NAME}
            </th>
            <th className="w-3" />
            <th colSpan={4} className="truncate px-1.5 pb-1 text-right text-[11px] font-extrabold uppercase text-foreground">
              {oppName}
            </th>
          </tr>
        </thead>
        {sections.map((section) => (
          <tbody key={section.title} className="border-t border-border">
            <tr>
              <td colSpan={9} className="bg-surface-muted px-1.5 py-1 text-center text-[11px] font-extrabold uppercase tracking-[0.05em] text-foreground">
                {section.title}
              </td>
            </tr>
            {section.rows.map((row) => (
              <PhaseRows key={row.key} label={row.label} us={splitCells(us[row.key], false)} opp={splitCells(opp[row.key], true)} phase={row.key} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function PhaseRows({
  label,
  us,
  opp,
  phase,
}: {
  label: string | null;
  us: { label: string; value: string }[];
  opp: { label: string; value: string }[];
  phase: string;
}) {
  return (
    <>
      {label && (
        <tr>
          <td colSpan={9} className="px-1.5 pt-1.5 text-center text-[11px] font-semibold text-foreground/80">
            {label}
          </td>
        </tr>
      )}
      <tr>
        {us.map((cell) => (
          <th key={`us-${cell.label}`} className={th}>
            {cell.label}
          </th>
        ))}
        <th className="w-3" />
        {opp.map((cell) => (
          <th key={`opp-${cell.label}`} className={th}>
            {cell.label}
          </th>
        ))}
      </tr>
      <tr data-scout-phase={phase}>
        {us.map((cell) => (
          <td key={`us-${cell.label}`} className={cn(td, cell.label === "Punti%" && "font-bold")}>
            {cell.value}
          </td>
        ))}
        <td className="w-3 border-l border-border" />
        {opp.map((cell) => (
          <td key={`opp-${cell.label}`} className={cn(td, cell.label === "Punti%" && "font-bold")}>
            {cell.value}
          </td>
        ))}
      </tr>
    </>
  );
}

function TeamSummary({ team, name }: { team: SheetTeam; name: string }) {
  const perReception = perPoint(team.receptionsFaced, team.sideOutPoints);
  const perServe = perPoint(team.serves, team.breakPoints);
  return (
    <div className="min-w-0" data-scout-summary={team.side}>
      <p className="truncate font-display text-[13px] font-extrabold uppercase text-foreground">{name}</p>
      <div className="mt-2 flex gap-4">
        <table className="tabular border-collapse text-[12px]" aria-label={`Punti per rotazione · ${name}`}>
          <thead>
            <tr>
              <th className={cn(th, "px-1 text-left")}>Rot.</th>
              <th className={cn(th, "px-1")} title="Punti fatti meno punti persi in quella rotazione">
                Diff
              </th>
            </tr>
          </thead>
          <tbody>
            {team.rotations.map((row) => (
              <tr key={row.rotation} data-scout-rotation-diff={row.rotation}>
                <td className="px-1 py-0.5 text-left font-bold">{row.rotation}ª</td>
                <td className="px-1 py-0.5 text-center" title={`${row.won} fatti, ${row.lost} persi`}>
                  {sheetBalance(row.won - row.lost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="min-w-0 space-y-2 text-[12.5px]">
          <div>
            <dt className="text-muted-foreground">Ricezioni</dt>
            <dd className="font-bold" data-scout-receptions-faced>
              {team.receptionsFaced} · punti CP {team.sideOutPoints}
            </dd>
            {perReception && <dd className="text-[11.5px] text-muted-foreground">ogni {perReception} ricezioni 1 punto</dd>}
          </div>
          <div>
            <dt className="text-muted-foreground">Battute</dt>
            <dd className="font-bold" data-scout-serves>
              {team.serves} · punti BP {team.breakPoints}
            </dd>
            {perServe && <dd className="text-[11.5px] text-muted-foreground">ogni {perServe} battute 1 break point</dd>}
          </div>
        </dl>
      </div>
    </div>
  );
}

export function TabellinoSheet({ sheet, match, over }: { sheet: ScoutSheet; match: Match; over: boolean }) {
  const category = match.category ? CATEGORY_LABELS[match.category] : "Settore giovanile";
  const won = over && sheet.setsWon.us !== sheet.setsWon.opp ? (sheet.setsWon.us > sheet.setsWon.opp ? "Vittoria" : "Sconfitta") : null;
  const info: [string, string][] = [
    ["Data", formatDateLong(match.matchDate.slice(0, 10))],
    ["Orario", match.matchDate.slice(11, 16)],
    ["Impianto", match.location],
    ["Gara", `${competitionOf(match)} · ${match.isHome ? "in casa" : "in trasferta"}`],
    ["Scout", `livello ${LEVEL_META[sheet.level].label}`],
  ];

  return (
    <article className="overflow-hidden rounded-2xl border border-border-strong/60 bg-card shadow-card" data-scout-sheet-doc>
      <div className="grid gap-4 border-b border-border p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" data-scout-result data-tour="scout-tab-result">
        <div className="min-w-0">
          <p className="font-display text-lg font-extrabold leading-tight text-foreground">
            {category} Femminile {seasonOf(match.matchDate)}
          </p>
          <p className="text-sm text-muted-foreground">{competitionOf(match)}</p>
          <p className="mt-3 border-t border-border pt-2 font-display text-xl font-extrabold text-foreground">Tabellino</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            {over ? "Risultato dello scout" : "Partita in corso (risultato provvisorio)"}
            {won && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", won === "Vittoria" ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive")} data-scout-outcome>
                {won}
              </span>
            )}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border-2 border-foreground/80 px-4 py-2.5" aria-label="Set vinti">
          {[
            { side: "us" as const, name: US_NAME, sets: sheet.setsWon.us },
            { side: "opp" as const, name: match.opponent, sets: sheet.setsWon.opp },
          ].map((row) => (
            <p key={row.side} className="flex items-baseline justify-between gap-3 font-display text-lg font-extrabold uppercase leading-snug text-foreground sm:text-xl">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="tabular text-2xl" data-scout-result-us={row.side === "us" ? "" : undefined} data-scout-result-opp={row.side === "opp" ? "" : undefined}>
                {row.sets}
              </span>
            </p>
          ))}
        </div>

        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-1 rounded-xl border border-border px-4 py-3 text-[13px]">
          {info.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="font-bold text-foreground">{term}</dt>
              <dd className="min-w-0 text-foreground/85">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
          <table className="tabular w-full min-w-[18rem] border-collapse text-[13px]" data-scout-sets-table>
            <thead className="bg-surface-muted">
              <tr>
                <th className={cn(th, "text-left")}>Set</th>
                <th className={th}>Durata</th>
                <th className={th}>Punteggi parziali</th>
                <th className={th}>Finali</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {sheet.sets.map((set) => (
                <tr key={set.n} data-scout-sheet-set={set.n}>
                  <td className="px-2 py-1 text-left font-bold">{set.n}</td>
                  <td className={td}>{sheetMinutes(set.minutes)}</td>
                  <td className={cn(td, "whitespace-nowrap text-foreground/85")}>{set.partials.map(sheetScore).join("   ") || "–"}</td>
                  <td className={cn(td, "whitespace-nowrap font-extrabold")}>
                    {sheetScore(set.final)}
                    {!set.closed && <span className="ml-1 text-[10px] font-semibold text-muted-foreground">in corso</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-muted/60 font-bold">
                <td className="px-2 py-1 text-left text-[11px] uppercase text-muted-foreground">Totale</td>
                <td className={td}>{sheetMinutes(sheet.totalMinutes)}</td>
                <td />
                <td className={cn(td, "whitespace-nowrap")}>{sheetScore(sheet.totalPoints)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div data-tour="scout-tab-players">
        <TeamTable team={sheet.us} name={US_NAME} sets={sheet.sets.length} />
        <TeamTable team={sheet.opp} name={match.opponent} sets={sheet.sets.length} />
      </div>

      <div className="grid gap-5 border-b border-border p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]" data-tour="scout-tab-summary" data-scout-sheet-summary>
        <TeamSummary team={sheet.us} name={US_NAME} />
        <div className="min-w-0 rounded-xl border border-border px-3 py-2">
          {sheet.us.attackPhases && sheet.opp.attackPhases ? (
            <AttackPhases us={sheet.us.attackPhases} opp={sheet.opp.attackPhases} oppName={match.opponent} />
          ) : sheet.us.sideOutByReception ? (
            <div className="space-y-2 py-1 text-[12.5px]" data-scout-sideout-by-reception>
              <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.05em] text-foreground">Cambio palla dopo la ricezione · {US_NAME}</p>
              {[
                { label: "Ricezione positiva (# +)", cell: sheet.us.sideOutByReception.positive },
                { label: "Ricezione negativa (! - /)", cell: sheet.us.sideOutByReception.negative },
              ].map(({ label, cell }) => (
                <p key={label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular font-bold">
                    {cell.total ? `${cell.won} su ${cell.total} (${percent(cell.won, cell.total)}%)` : "."}
                  </span>
                </p>
              ))}
              <p className="text-[11.5px] text-muted-foreground">Primo attacco dopo la ricezione e contrattacco si contano a livello Completo.</p>
            </div>
          ) : (
            <p className="py-2 text-center text-[12.5px] text-muted-foreground">
              Il cambio palla diretto (il primo attacco dopo la ricezione) e il contrattacco si contano a livello Completo; il cambio palla dopo la ricezione da «Con ricezioni».
            </p>
          )}
        </div>
        <TeamSummary team={sheet.opp} name={match.opponent} />
      </div>

      <div className="space-y-2 bg-surface-muted/50 px-4 py-3 text-[12px] text-muted-foreground sm:px-5" data-tour="scout-tab-legend">
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {[...SHEET_LEGEND, ...SHEET_MARKS].map(([term, text]) => (
            <div key={term}>
              <dt className="inline font-bold text-foreground">{term}</dt> <dd className="inline">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="leading-relaxed">{sheetFootnote(sheet.level)}</p>
      </div>
    </article>
  );
}
