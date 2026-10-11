import { cn } from "@/lib/cn";
import { percent, type GradeCounts } from "@/lib/scout/stats";
import { GRADE_META, gradeSymbol } from "@/lib/scout/touches";
import { SCOUT_GRADES, type ScoutGrade } from "@/lib/scout/types";

/**
 * I voti dello scout (# + ! − / =) in pagina: il pallino col simbolo, la barra
 * a segmenti e la legenda. Il colore non è mai l'unico segno: ogni voto ha il
 * suo simbolo, scritto dentro il segmento quando c'è spazio, e la legenda lo
 * spiega.
 */

export const GRADE_FILL: Record<ScoutGrade, string> = {
  "#": "bg-grade-perfect text-grade-perfect-ink",
  "+": "bg-grade-positive text-grade-positive-ink",
  "!": "bg-grade-neutral text-grade-neutral-ink",
  "-": "bg-grade-negative text-grade-negative-ink",
  "/": "bg-grade-poor text-grade-poor-ink",
  "=": "bg-grade-error text-grade-error-ink",
};

/** Il pallino col simbolo del voto. */
export function GradeDot({ grade, size = "md", className }: { grade: ScoutGrade; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-display font-extrabold leading-none ring-1 ring-inset ring-foreground/15",
        size === "sm" ? "h-[18px] w-[18px] text-[11px]" : size === "lg" ? "h-8 w-8 text-lg" : "h-6 w-6 text-sm",
        GRADE_FILL[grade],
        className,
      )}
    >
      {gradeSymbol(grade)}
    </span>
  );
}

/** Quanti tocchi in tutto, sommando i sei voti. */
export function totalOf(counts: GradeCounts): number {
  return SCOUT_GRADES.reduce((sum, grade) => sum + counts[grade], 0);
}

/**
 * Una barra a segmenti: quante volte ogni voto, in proporzione. Tra un segmento
 * e l'altro c'è uno spazio di 2 px; il simbolo compare dentro se il segmento è
 * abbastanza largo. Senza dati resta una barra vuota.
 */
export function GradeBar({
  counts,
  label,
  size = "md",
  className,
}: {
  counts: GradeCounts;
  /** Chi o cosa è (per chi legge con lo screen reader e per i suggerimenti). */
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const total = totalOf(counts);
  const height = size === "lg" ? "h-9" : size === "sm" ? "h-4" : "h-6";
  const summary = SCOUT_GRADES.filter((g) => counts[g] > 0)
    .map((g) => `${gradeSymbol(g)} ${counts[g]}`)
    .join(", ");
  if (total === 0) {
    return <div className={cn("w-full rounded-full bg-muted", height, className)} role="img" aria-label={`${label}: nessuna ricezione segnata`} />;
  }
  return (
    <div
      className={cn("flex w-full gap-0.5 overflow-hidden rounded-full", height, className)}
      role="img"
      aria-label={`${label}: ${summary}`}
      data-scout-grade-bar
    >
      {SCOUT_GRADES.filter((g) => counts[g] > 0).map((g) => {
        const share = percent(counts[g], total) ?? 0;
        return (
          <span
            key={g}
            style={{ flexGrow: counts[g], flexBasis: 0 }}
            title={`${label} · ${GRADE_META[g].name} (${gradeSymbol(g)}): ${counts[g]} su ${total} (${share}%)`}
            className={cn(
              "grid min-w-[4px] place-items-center overflow-hidden text-[11px] font-extrabold leading-none ring-1 ring-inset ring-foreground/10 first:rounded-l-full last:rounded-r-full",
              GRADE_FILL[g],
            )}
          >
            {share >= 9 ? gradeSymbol(g) : null}
          </span>
        );
      })}
    </div>
  );
}

/** La legenda dei sei voti, con il nome che hanno per un fondamentale (es. quelli della ricezione). */
export function GradeLegend({ names, className }: { names?: Partial<Record<ScoutGrade, string>>; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)} aria-label="Legenda dei voti" data-scout-grade-legend>
      {SCOUT_GRADES.map((g) => (
        <li key={g} className="inline-flex items-center gap-1.5">
          <GradeDot grade={g} size="sm" />
          <span>
            <b className="font-bold text-foreground">{gradeSymbol(g)}</b> {names?.[g] ?? GRADE_META[g].name}
          </span>
        </li>
      ))}
    </ul>
  );
}
