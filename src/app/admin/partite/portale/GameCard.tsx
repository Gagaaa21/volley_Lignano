import type { ReactNode } from "react";
import { CATEGORY_LABELS } from "@/lib/category";
import { Badge } from "@/components/ui/Badge";
import type { OfficialResultFormState } from "../official-actions";
import type { PortalGame } from "@/lib/federation/portal";
import { sideLabel, whenLabel } from "./format";

/** Prima riga di ogni gara: categoria, data e numero di gara del portale. */
export function GameMeta({ game, extra }: { game: PortalGame; extra?: ReactNode }) {
  const { official, category } = game;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Badge tone={category === "U14" ? "u14" : "u15"}>{CATEGORY_LABELS[category]}</Badge>
      <span>
        Gara {official.externalId}
        {official.round !== null && ` · giornata ${official.round}`}
      </span>
      {extra}
    </div>
  );
}

/** La gara come la scrive il portale, dal nostro punto di vista. */
export function OfficialLine({ game, withVenue = false }: { game: PortalGame; withVenue?: boolean }) {
  return (
    <p className="mt-1.5 text-sm">
      <span className="font-display text-base font-bold text-foreground">vs {game.opponent}</span>
      <span className="text-muted-foreground">
        {" "}
        · {sideLabel(game.side === "home")} · {whenLabel(game.official.date)}
        {withVenue && game.official.venue ? ` · ${game.official.venue}` : ""}
      </span>
    </p>
  );
}

/** Esito dell'ultima azione sotto i pulsanti di una riga. */
export function Feedback({ states }: { states: OfficialResultFormState[] }) {
  const error = states.find((state) => state.error)?.error;
  if (error) return <p className="mt-2 text-sm font-medium text-destructive">{error}</p>;
  const message = states.find((state) => state.message)?.message;
  if (message) return <p className="mt-2 text-sm font-medium text-success">{message}</p>;
  return null;
}

/** Campi nascosti che identificano la gara in ogni modulo di una riga. */
export function GameFields({ game }: { game: PortalGame }) {
  return (
    <>
      <input type="hidden" name="category" value={game.category} />
      <input type="hidden" name="externalId" value={game.official.externalId} />
    </>
  );
}
