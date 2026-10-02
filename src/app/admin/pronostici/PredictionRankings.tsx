import { Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SetRankingEntry } from "@/lib/predictions";

/** Badge per set con i pronostici di tutti, il vincitore evidenziato —
 * condiviso tra il dettaglio pronostico e l'hub, per partite normali e
 * tornei (una partita del torneo usa la stessa forma di un set). */
export function SetRankingBadges({
  rankings,
  nameById,
}: {
  rankings: SetRankingEntry[];
  nameById: Map<string, string>;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {rankings.map((entry) => (
        <span
          key={entry.staffId}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            entry.isWinner ? "bg-sand-400 text-sea-950" : "bg-card text-foreground/70 ring-1 ring-border",
          )}
        >
          {entry.isWinner && <Trophy className="h-3 w-3" />}
          {nameById.get(entry.staffId) ?? "Utente rimosso"}: {entry.predicted.us}-{entry.predicted.them}
        </span>
      ))}
    </div>
  );
}
