import { Trophy } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { CardBody } from "@/components/ui/Card";
import type { SeasonRecord } from "@/lib/publicCalendarData";

const CATEGORY_GRADIENT: Record<SeasonRecord["category"], string> = {
  U14: "bg-[linear-gradient(135deg,var(--color-u14),var(--color-u14-strong))]",
  U15: "bg-[linear-gradient(135deg,var(--color-u15),var(--color-u15-strong))]",
};

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
    <div className="mt-10">
      <p className="eyebrow">
        <Trophy className="h-3 w-3" />
        Bilancio stagione
      </p>
      <h2 className="mt-1.5 font-display text-lg font-bold text-foreground">Come va il campionato</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {withGames.map((r) => (
          <div key={r.category} className="stat-card">
            <CardBody className="pt-5">
              <div className="flex items-center gap-3">
                <span className={cn("icon-chip", CATEGORY_GRADIENT[r.category])}>
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {r.wins}-{r.losses}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[r.category]} · {r.played} giocat{r.played === 1 ? "a" : "e"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-foreground/40">
                Set: {r.setsWon}-{r.setsLost}
              </p>
            </CardBody>
          </div>
        ))}
      </div>
    </div>
  );
}
