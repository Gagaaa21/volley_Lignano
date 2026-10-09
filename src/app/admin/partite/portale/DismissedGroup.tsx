"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import type { PortalGame } from "@/lib/federation/portal";
import { Button } from "@/components/ui/Button";
import { restoreOfficialResultAction, type OfficialResultFormState } from "../official-actions";
import { Feedback, GameFields, GameMeta, OfficialLine } from "./GameCard";
import { resultLabel } from "./format";

const initialState: OfficialResultFormState = {};

function DismissedRow({ game }: { game: PortalGame }) {
  const [state, formAction, pending] = useActionState(restoreOfficialResultAction, initialState);
  return (
    <li className="px-4 py-3.5 sm:px-5" data-portal-game={game.official.externalId} data-portal-status={game.status}>
      <GameMeta game={game} />
      <OfficialLine game={game} />
      {game.result && (
        <p className="tabular mt-0.5 text-sm text-muted-foreground">{resultLabel(game.result.us, game.result.them)}</p>
      )}
      <form action={formAction} className="mt-2">
        <GameFields game={game} />
        <Button type="submit" variant="outline" size="xs" disabled={pending}>
          <RotateCcw className="h-3.5 w-3.5" />
          Ripristina
        </Button>
      </form>
      <Feedback states={[state]} />
    </li>
  );
}

/** Gare ignorate da un admin: chiuse in fondo, si possono rimettere tra quelle da decidere. */
export function DismissedGroup({ games }: { games: PortalGame[] }) {
  return (
    <details className="rounded-2xl border border-border bg-card shadow-card" data-portal-dismissed>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground sm:px-5">
        Gare ignorate ({games.length})
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {games.map((game) => (
          <DismissedRow key={`${game.category}-${game.official.externalId}`} game={game} />
        ))}
      </ul>
    </details>
  );
}
