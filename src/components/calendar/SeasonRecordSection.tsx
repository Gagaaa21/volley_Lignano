import { CATEGORY_DOT, CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { SectionHeading } from "@/components/ui/PageHeader";
import type { SeasonRecord } from "@/lib/publicCalendarData";

/**
 * Bilancio stagione (vinte-perse) per categoria, solo partite di
 * campionato con un risultato registrato: amichevoli e tornei non hanno
 * un vinta/persa ufficiale, quindi restano fuori (vedi
 * getPublicSeasonRecord). Nessuna card per una categoria senza ancora
 * partite giocate, e l'intera sezione sparisce se non ce n'è nessuna.
 */
export function SeasonRecordSection({ records }: { records: SeasonRecord[] }) {
  const withGames = records.filter((r) => r.played > 0);
  if (withGames.length === 0) return null;

  return (
    <section className="mt-12">
      <SectionHeading title="Bilancio stagione" description="Partite di campionato con il risultato registrato." />
      <div className="grid gap-4 sm:grid-cols-2">
        {withGames.map((r) => {
          const winPct = Math.round((r.wins / r.played) * 100);
          return (
            <div key={r.category} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
              <span className={cn("absolute inset-x-0 top-0 h-1", CATEGORY_DOT[r.category])} aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                  <span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_DOT[r.category])} aria-hidden />
                  {CATEGORY_LABELS[r.category]}
                </p>
                <p className="text-[13px] font-medium text-muted-foreground">
                  {r.played} {r.played === 1 ? "partita giocata" : "partite giocate"}
                </p>
              </div>

              <div className="mt-5 flex items-end gap-7">
                <div>
                  <p className="display-wide tabular text-[2.75rem] leading-none text-success">{r.wins}</p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {r.wins === 1 ? "Vinta" : "Vinte"}
                  </p>
                </div>
                <div>
                  <p className="display-wide tabular text-[2.75rem] leading-none text-foreground/75">{r.losses}</p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {r.losses === 1 ? "Persa" : "Perse"}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="tabular text-lg font-bold leading-none text-foreground">
                    {r.setsWon}–{r.setsLost}
                  </p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Set</p>
                </div>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${winPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{winPct}% di vittorie</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
