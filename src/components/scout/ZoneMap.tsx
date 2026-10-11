import { cn } from "@/lib/cn";
import { percent, zonedTouches, type ZoneGrid } from "@/lib/scout/stats";

/**
 * Il campo con le sei zone, viste dalla propria metà e con la rete in alto:
 * davanti 4-3-2, dietro 5-6-1. In ogni zona la percentuale di tocchi riusciti
 * e quanti ne sono stati segnati. L'intensità del colore va dal poco al molto
 * riuscito (un solo colore, dal chiaro allo scuro), e il numero c'è sempre:
 * il colore non è l'unico segno.
 */

const ROWS: number[][] = [
  [4, 3, 2],
  [5, 6, 1],
];

const STEPS = [
  "bg-muted text-muted-foreground",
  "bg-primary/10 text-foreground",
  "bg-primary/20 text-foreground",
  "bg-primary/35 text-foreground",
  "bg-primary/55 text-foreground",
  "bg-primary/75 text-primary-foreground",
] as const;

function step(good: number, total: number): number {
  if (total === 0) return 0;
  const p = (good / total) * 100;
  return p < 25 ? 1 : p < 40 ? 2 : p < 55 ? 3 : p < 70 ? 4 : 5;
}

export function ZoneMap({
  grid,
  title,
  goodLabel,
  lostLabel,
}: {
  grid: ZoneGrid;
  title: string;
  /** Che cosa conta come riuscito («positive», «punti»…). */
  goodLabel: string;
  /** Che cosa conta come perso («errori o scarse», «errori o murati»…). */
  lostLabel: string;
}) {
  if (zonedTouches(grid) === 0) return null;
  return (
    <figure data-scout-zone-map={title} className="w-full min-w-[15rem] max-w-[19rem] flex-1 basis-[16rem]">
      <div className="relative rounded-xl border border-border-strong bg-surface-muted p-2">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Rete</p>
        <div className="grid gap-1.5">
          {ROWS.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-1.5">
              {row.map((zone) => {
                const cell = grid[zone];
                const good = percent(cell.good, cell.total);
                return (
                  <div
                    key={zone}
                    title={
                      cell.total === 0
                        ? `Zona ${zone}: nessun tocco`
                        : `Zona ${zone}: ${cell.total} tocchi, ${cell.good} ${goodLabel}, ${cell.lost} ${lostLabel}`
                    }
                    data-scout-zone={zone}
                    className={cn("flex min-h-[4.5rem] flex-col items-center justify-center rounded-lg px-1 py-2 text-center", STEPS[step(cell.good, cell.total)])}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] opacity-75">Zona {zone}</span>
                    <span className="tabular font-display text-lg font-extrabold leading-tight">{cell.total === 0 ? "–" : `${good}%`}</span>
                    <span className="tabular text-[11px] opacity-80">{cell.total === 0 ? "" : `${cell.total} tocchi`}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {title}: la percentuale di tocchi <b className="text-foreground">{goodLabel}</b> in ogni zona. Più scuro = più riusciti.
      </figcaption>
    </figure>
  );
}
