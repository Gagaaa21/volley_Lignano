import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/category";
import type { PortalCategoryView, PortalGame, PortalGameStatus } from "@/lib/federation/portal";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { sideLabel, whenLabel } from "./format";

const STATUS: Record<PortalGameStatus, { label: string; tone: BadgeTone }> = {
  ok: { label: "Nel sito", tone: "success" },
  result: { label: "Risultato da confermare", tone: "primary" },
  conflict: { label: "Risultato diverso", tone: "warning" },
  changed: { label: "Cambiata sul portale", tone: "warning" },
  "maybe-same": { label: "Da verificare", tone: "warning" },
  "played-missing": { label: "Manca nel sito", tone: "warning" },
  "to-add": { label: "Non nel sito", tone: "neutral" },
  "waiting-sets": { label: "In attesa dei parziali", tone: "neutral" },
  dismissed: { label: "Ignorata", tone: "neutral" },
};

function GameRow({ game }: { game: PortalGame }) {
  const status = STATUS[game.status];
  const score = game.result ? `${game.result.us}–${game.result.them}` : null;
  const content = (
    <>
      <span className="tabular w-[7.5rem] shrink-0 text-xs text-muted-foreground sm:w-36">
        {whenLabel(game.official.date)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">vs {game.opponent}</span>
        <span className="block text-xs text-muted-foreground">
          {sideLabel(game.side === "home")} · gara {game.official.externalId}
        </span>
        <Badge tone={status.tone} className="mt-1 sm:hidden">
          {status.label}
        </Badge>
      </span>
      {score && <span className="tabular text-sm font-bold text-foreground">{score}</span>}
      <Badge tone={status.tone} className="hidden sm:inline-flex">
        {status.label}
      </Badge>
    </>
  );
  const className = "flex items-center gap-3 px-4 py-2.5 sm:px-5";
  return (
    <li data-portal-game={game.official.externalId} data-portal-status={game.status}>
      {game.match ? (
        <Link href={`/admin/partite/${game.match.id}`} className={`${className} transition-colors hover:bg-surface-muted`}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

/** Tutte le gare ufficiali della squadra, con lo stato di ognuna nel sito. Chiuso: è un riepilogo. */
export function FullCalendar({ views }: { views: PortalCategoryView[] }) {
  return (
    <div className="space-y-3">
      {views.map((view) => {
        const inSite = view.games.filter((game) => game.match).length;
        return (
          <details
            key={view.category}
            className="rounded-2xl border border-border bg-card shadow-card"
            data-portal-calendar={view.category}
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground sm:px-5">
              <Badge tone={view.category === "U14" ? "u14" : "u15"}>{CATEGORY_LABELS[view.category]}</Badge>
              {view.games.length} gare in calendario
              <span className="font-normal text-muted-foreground">· {inSite} già nel sito</span>
            </summary>
            {view.games.length === 0 ? (
              <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
                Nel girone non c&apos;è ancora nessuna gara della squadra.
              </p>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {view.games.map((game) => (
                  <GameRow key={game.official.externalId} game={game} />
                ))}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
