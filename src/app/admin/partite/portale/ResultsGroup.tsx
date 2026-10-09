"use client";

import { useActionState } from "react";
import { Check, CheckCheck, X } from "lucide-react";
import type { PortalGame } from "@/lib/federation/portal";
import type { Category } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { List } from "@/components/ui/List";
import {
  applyOfficialResultAction,
  confirmAllResultsAction,
  dismissOfficialResultAction,
  type OfficialResultFormState,
} from "../official-actions";
import { Feedback, GameFields, GameMeta, OfficialLine } from "./GameCard";
import { resultLabel, setsLine, siteMatchLabel } from "./format";

const initialState: OfficialResultFormState = {};

/** Gara giocata con una partita del sito senza risultato: un clic compila i set. */
function ResultRow({ game }: { game: PortalGame }) {
  const [applyState, applyAction, applyPending] = useActionState(applyOfficialResultAction, initialState);
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissOfficialResultAction, initialState);
  const busy = applyPending || dismissPending;
  const { result, match, official } = game;
  if (!result || !match) return null;

  return (
    <li className="px-4 py-4 sm:px-5" data-portal-game={official.externalId} data-portal-status={game.status}>
      <GameMeta game={game} extra={official.status ? <span>· {official.status}</span> : null} />
      <OfficialLine game={game} />
      <p className="tabular mt-1 text-sm font-semibold text-foreground">
        {resultLabel(result.us, result.them)}
        {setsLine(result.sets) && (
          <span className="ml-2 font-normal text-muted-foreground">{setsLine(result.sets)}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Partita nel sito: {siteMatchLabel(match)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={applyAction}>
          <GameFields game={game} />
          <input type="hidden" name="matchId" value={match.id} />
          <Button type="submit" size="sm" disabled={busy}>
            <Check className="h-4 w-4" />
            {applyPending ? "Salvo…" : "Conferma risultato"}
          </Button>
        </form>
        <form action={dismissAction}>
          <GameFields game={game} />
          <Button type="submit" variant="quiet" size="sm" disabled={busy}>
            <X className="h-4 w-4" />
            Ignora
          </Button>
        </form>
      </div>
      <Feedback states={[applyState, dismissState]} />
    </li>
  );
}

/** «Risultati da confermare»: uno per riga, o tutti insieme (solo la categoria
 * mostrata, se la pagina è filtrata). */
export function ResultsGroup({ games, category }: { games: PortalGame[]; category: Category | null }) {
  const [state, formAction, pending] = useActionState(confirmAllResultsAction, initialState);
  return (
    <div>
      {games.length > 1 && (
        <form action={formAction} className="mb-3 flex flex-wrap items-center gap-3">
          {category && <input type="hidden" name="category" value={category} />}
          <Button type="submit" variant="soft" size="sm" disabled={pending}>
            <CheckCheck className="h-4 w-4" />
            {pending ? "Salvo…" : `Conferma tutti (${games.length})`}
          </Button>
          <Feedback states={[state]} />
        </form>
      )}
      <List>
        <ul className="divide-y divide-border">
          {games.map((game) => (
            <ResultRow key={`${game.category}-${game.official.externalId}`} game={game} />
          ))}
        </ul>
      </List>
    </div>
  );
}
