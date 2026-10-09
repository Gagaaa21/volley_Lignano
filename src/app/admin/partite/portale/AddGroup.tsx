"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { PortalGame } from "@/lib/federation/portal";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import type { Category } from "@/lib/types";
import { importOfficialCalendarAction, type OfficialResultFormState } from "../official-actions";
import { Feedback, GameMeta, OfficialLine } from "./GameCard";

const initialState: OfficialResultFormState = {};

/** Gare da giocare che nel sito mancano (una categoria): tutte spuntate,
 * si toglie la spunta a quelle che non si vogliono. */
function CategoryAdd({ category, games }: { category: Category; games: PortalGame[] }) {
  const [state, formAction, pending] = useActionState(importOfficialCalendarAction, initialState);
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const isChecked = (game: PortalGame) => !unchecked[game.official.externalId];
  const selected = games.filter(isChecked).length;

  return (
    <form action={formAction} data-portal-add={category}>
      <input type="hidden" name="category" value={category} />
      <List>
        <ul className="divide-y divide-border">
          {games.map((game) => {
            const id = `add-${category}-${game.official.externalId}`;
            return (
              <li
                key={game.official.externalId}
                data-portal-game={game.official.externalId}
                data-portal-status={game.status}
              >
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3 px-4 py-3.5 sm:px-5">
                  <input
                    id={id}
                    type="checkbox"
                    name="externalId"
                    value={game.official.externalId}
                    checked={isChecked(game)}
                    onChange={(event) =>
                      setUnchecked((prev) => ({ ...prev, [game.official.externalId]: !event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <GameMeta game={game} />
                    <OfficialLine game={game} withVenue />
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
          description="Una sola notifica a chi segue il calendario, non una per partita."
        />
        <Button type="submit" disabled={pending || selected === 0}>
          <CalendarPlus className="h-4 w-4" />
          {pending ? "Aggiungo…" : selected === 1 ? "Aggiungi 1 partita" : `Aggiungi ${selected} partite`}
        </Button>
      </div>
      <Feedback states={[state]} />
    </form>
  );
}

/** «Da aggiungere al sito», una scheda per categoria. */
export function AddGroup({ games }: { games: PortalGame[] }) {
  const categories = [...new Set(games.map((game) => game.category))];
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <CategoryAdd key={category} category={category} games={games.filter((game) => game.category === category)} />
      ))}
    </div>
  );
}
