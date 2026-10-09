"use client";

import { useActionState, useState } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { PortalGame } from "@/lib/federation/portal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import type { Category } from "@/lib/types";
import { updateOfficialGamesAction, type OfficialResultFormState } from "../official-actions";
import { Feedback, GameMeta } from "./GameCard";
import { sideLabel, whenLabel } from "./format";

const initialState: OfficialResultFormState = {};

/** Cosa cambia, a parole: «Cambia l'avversaria, la data e la palestra.» */
function changeSummary(game: PortalGame): string {
  const changed = game.changed;
  if (!changed) return "";
  const differentGame = changed.opponent || changed.side;
  const parts: string[] = [];
  if (changed.opponent) parts.push("l'avversaria");
  else if (changed.side) parts.push("casa/trasferta");
  if (changed.date) parts.push("la data o l'ora");
  if (differentGame) parts.push("la palestra");
  if (parts.length === 1) return `Cambia ${parts[0]}.`;
  return `Cambiano ${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}.`;
}

/** Partite già nel sito che il portale ha cambiato (una categoria): si
 * spuntano quelle da portare a quello che dice il portale. */
function CategoryChanges({ category, games }: { category: Category; games: PortalGame[] }) {
  const [state, formAction, pending] = useActionState(updateOfficialGamesAction, initialState);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const isChecked = (game: PortalGame) => !unchecked[game.official.externalId];
  const selected = games.filter(isChecked).length;

  return (
    <form action={formAction} data-portal-changes={category}>
      <input type="hidden" name="category" value={category} />
      <List>
        <ul className="divide-y divide-border">
          {games.map((game) => {
            const { official, side, opponent, match, changed } = game;
            if (!match) return null;
            const id = `change-${category}-${official.externalId}`;
            const differentGame = Boolean(changed?.opponent || changed?.side);
            return (
              <li key={official.externalId} data-portal-game={official.externalId} data-portal-status={game.status}>
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-4 py-4 sm:px-5">
                  <input
                    id={id}
                    type="checkbox"
                    name="externalId"
                    value={official.externalId}
                    checked={isChecked(game)}
                    onChange={(event) =>
                      setUnchecked((prev) => ({ ...prev, [official.externalId]: !event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <GameMeta game={game} />
                    <span className="mt-2 block text-muted-foreground">
                      Nel sito: <span className="font-semibold text-foreground/80">vs {match.opponent}</span> ·{" "}
                      {sideLabel(match.isHome)} · {whenLabel(match.matchDate)}
                    </span>
                    <span className="mt-0.5 flex items-start gap-1.5 font-semibold text-warning">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        Sul portale:{" "}
                        <span className="font-display font-bold text-foreground">vs {opponent}</span> ·{" "}
                        {sideLabel(side === "home")} · {whenLabel(official.date)}
                        {differentGame && official.venue ? ` · ${official.venue}` : ""}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{changeSummary(game)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </List>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Toggle
          name="notify"
          label="Avvisa con una notifica"
          description="Una sola notifica a chi segue il calendario."
          defaultChecked
        />
        <Button type="submit" disabled={pending || selected === 0}>
          <CalendarClock className="h-4 w-4" />
          {pending ? "Aggiorno…" : selected === 1 ? "Aggiorna 1 partita" : `Aggiorna ${selected} partite`}
        </Button>
      </div>
      <Feedback states={[state]} />
    </form>
  );
}

/** «Partite cambiate sul portale», una scheda per categoria. */
export function ChangesGroup({ games }: { games: PortalGame[] }) {
  const categories = [...new Set(games.map((game) => game.category))];
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <CategoryChanges
          key={category}
          category={category}
          games={games.filter((game) => game.category === category)}
        />
      ))}
    </div>
  );
}
