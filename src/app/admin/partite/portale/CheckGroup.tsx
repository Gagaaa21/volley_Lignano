"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarPlus, Check, Link2, Trash2, X } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { OrphanMatch } from "@/lib/federation/calendarImport";
import type { PortalGame } from "@/lib/federation/portal";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { List } from "@/components/ui/List";
import type { Category } from "@/lib/types";
import { deleteMatchAction } from "../actions";
import {
  applyOfficialResultAction,
  dismissOfficialResultAction,
  importOfficialCalendarAction,
  linkOfficialGameAction,
  markFriendlyAction,
  type OfficialResultFormState,
} from "../official-actions";
import { Feedback, GameFields, GameMeta, OfficialLine } from "./GameCard";
import { resultLabel, setsLine, siteMatchLabel, sideLabel, whenLabel } from "./format";

const initialState: OfficialResultFormState = {};

function Question({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-warning">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function IgnoreButton({ game, busy, action }: { game: PortalGame; busy: boolean; action: (data: FormData) => void }) {
  return (
    <form action={action}>
      <GameFields game={game} />
      <Button type="submit" variant="quiet" size="sm" disabled={busy}>
        <X className="h-4 w-4" />
        Ignora
      </Button>
    </form>
  );
}

/** Risultato già scritto nel sito e diverso da quello ufficiale: resta il vostro, a meno di una scelta esplicita. */
function ConflictRow({ game }: { game: PortalGame }) {
  const [applyState, applyAction, applyPending] = useActionState(applyOfficialResultAction, initialState);
  const [keepState, keepAction, keepPending] = useActionState(dismissOfficialResultAction, initialState);
  const busy = applyPending || keepPending;
  const { match, result } = game;
  if (!match || !result) return null;
  const mySets = match.setScores?.map((set) => ({ us: set.us, them: set.them })) ?? null;

  return (
    <li className="px-4 py-4 sm:px-5" data-portal-game={game.official.externalId} data-portal-status={game.status}>
      <GameMeta game={game} />
      <OfficialLine game={game} />
      <Question>Nel sito hai scritto un risultato diverso da quello ufficiale: per ora resta il tuo.</Question>
      <dl className="tabular mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-foreground/85">
        <dt className="font-semibold">Nel sito</dt>
        <dd>
          {match.resultSetsWon}–{match.resultSetsLost}
          {setsLine(mySets) && <span className="ml-2 text-muted-foreground">{setsLine(mySets)}</span>}
        </dd>
        <dt className="font-semibold">Ufficiale</dt>
        <dd>
          {result.us}–{result.them}
          {setsLine(result.sets) && <span className="ml-2 text-muted-foreground">{setsLine(result.sets)}</span>}
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={keepAction}>
          <GameFields game={game} />
          <Button type="submit" size="sm" disabled={busy}>
            <Check className="h-4 w-4" />
            Tieni il mio
          </Button>
        </form>
        {result.sets && (
          <form action={applyAction}>
            <GameFields game={game} />
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="overwrite" value="1" />
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              Usa quello ufficiale
            </Button>
          </form>
        )}
      </div>
      <Feedback states={[applyState, keepState]} />
    </li>
  );
}

/** Gara non trovata nel sito, ma con una partita simile in un altro giorno: è la stessa? */
function MaybeSameRow({ game }: { game: PortalGame }) {
  const [linkState, linkAction, linkPending] = useActionState(linkOfficialGameAction, initialState);
  const [addState, addAction, addPending] = useActionState(importOfficialCalendarAction, initialState);
  const [ignoreState, ignoreAction, ignorePending] = useActionState(dismissOfficialResultAction, initialState);
  const busy = linkPending || addPending || ignorePending;
  const { similar, result } = game;
  if (!similar) return null;
  const canSaveResult = Boolean(result?.sets) && similar.resultSetsWon === null;

  return (
    <li className="px-4 py-4 sm:px-5" data-portal-game={game.official.externalId} data-portal-status={game.status}>
      <GameMeta game={game} />
      <OfficialLine game={game} />
      {result && <p className="tabular mt-0.5 text-sm text-muted-foreground">Giocata: {resultLabel(result.us, result.them)}</p>}
      <p className="mt-2 text-sm text-foreground/80">
        Nel sito c&apos;è <span className="font-semibold">{siteMatchLabel(similar)}</span>.
      </p>
      <Question>È la stessa partita, spostata o scritta in un altro modo?</Question>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={linkAction}>
          <GameFields game={game} />
          <input type="hidden" name="matchId" value={similar.id} />
          <Button type="submit" size="sm" disabled={busy}>
            <Link2 className="h-4 w-4" />
            {result ? (canSaveResult ? "Sì: collega e salva il risultato" : "Sì: collega") : "Sì: collega e aggiorna il sito"}
          </Button>
        </form>
        <form action={addAction}>
          <GameFields game={game} />
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            <CalendarPlus className="h-4 w-4" />
            No: è un&apos;altra, aggiungila
          </Button>
        </form>
        <IgnoreButton game={game} busy={busy} action={ignoreAction} />
      </div>
      {!result && (
        <p className="mt-2 text-xs text-muted-foreground">
          Collegando, la partita del sito prende data e ora del portale; ritrovo, note e convocazioni restano.
        </p>
      )}
      <Feedback states={[linkState, addState, ignoreState]} />
    </li>
  );
}

/** Gara giocata che nel sito manca del tutto. */
function PlayedMissingRow({ game }: { game: PortalGame }) {
  const [addState, addAction, addPending] = useActionState(importOfficialCalendarAction, initialState);
  const [linkState, linkAction, linkPending] = useActionState(linkOfficialGameAction, initialState);
  const [ignoreState, ignoreAction, ignorePending] = useActionState(dismissOfficialResultAction, initialState);
  const busy = addPending || linkPending || ignorePending;
  const { result, candidates } = game;
  if (!result) return null;

  return (
    <li className="px-4 py-4 sm:px-5" data-portal-game={game.official.externalId} data-portal-status={game.status}>
      <GameMeta game={game} />
      <OfficialLine game={game} />
      <p className="tabular mt-0.5 text-sm font-semibold text-foreground">
        {resultLabel(result.us, result.them)}
        {setsLine(result.sets) && (
          <span className="ml-2 font-normal text-muted-foreground">{setsLine(result.sets)}</span>
        )}
      </p>
      <Question>Questa gara è stata giocata ma nel sito non c&apos;è.</Question>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <form action={addAction}>
          <GameFields game={game} />
          <Button type="submit" size="sm" disabled={busy}>
            <CalendarPlus className="h-4 w-4" />
            {result.sets ? "Aggiungila con il risultato" : "Aggiungila"}
          </Button>
        </form>
        <IgnoreButton game={game} busy={busy} action={ignoreAction} />
      </div>
      {candidates.length > 0 && (
        <form action={linkAction} className="mt-3 flex flex-wrap items-end gap-2">
          <GameFields game={game} />
          <label className="flex min-w-[15rem] flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground sm:flex-none">
            Oppure è una partita che hai già inserito?
            <Select name="matchId" required defaultValue="" className="h-9 text-sm font-normal text-foreground">
              <option value="" disabled>
                Scegli la partita del sito…
              </option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {siteMatchLabel(candidate)}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            <Link2 className="h-4 w-4" />
            Collega
          </Button>
        </form>
      )}
      <Feedback states={[addState, linkState, ignoreState]} />
    </li>
  );
}

/** Partita del sito senza nessuna gara del calendario ufficiale. */
function OrphanRow({
  category,
  orphan,
  linkable,
}: {
  category: Category;
  orphan: OrphanMatch;
  linkable: PortalGame[];
}) {
  const [linkState, linkAction, linkPending] = useActionState(linkOfficialGameAction, initialState);
  const [friendlyState, friendlyAction, friendlyPending] = useActionState(markFriendlyAction, initialState);
  const busy = linkPending || friendlyPending;
  const { match } = orphan;

  return (
    <li className="px-4 py-4 sm:px-5" data-portal-orphan={match.id}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Badge tone={category === "U14" ? "u14" : "u15"}>{CATEGORY_LABELS[category]}</Badge>
        <span>Partita del sito</span>
      </div>
      <p className="mt-1.5 text-sm">
        <Link href={`/admin/partite/${match.id}`} className="font-display text-base font-bold text-primary hover:underline">
          vs {match.opponent}
        </Link>
        <span className="text-muted-foreground">
          {" "}
          · {sideLabel(match.isHome)} · {whenLabel(match.matchDate)}
        </span>
      </p>
      <Question>
        {orphan.externalId
          ? `Era collegata alla gara ${orphan.externalId}, che ora sul portale è di altre squadre.`
          : "Nel calendario ufficiale della squadra non c'è una gara così."}
      </Question>
      <p className="mt-1 text-xs text-muted-foreground">
        Collegala alla gara giusta, segnala come amichevole se non è di campionato, oppure eliminala se è stata
        cancellata.
      </p>

      {linkable.length > 0 && (
        <form action={linkAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="matchId" value={match.id} />
          <label className="flex min-w-[15rem] flex-1 flex-col gap-1 text-xs font-semibold text-muted-foreground sm:flex-none">
            È questa gara del portale
            <Select name="externalId" required defaultValue="" className="h-9 text-sm font-normal text-foreground">
              <option value="" disabled>
                Scegli la gara…
              </option>
              {linkable.map((game) => (
                <option key={game.official.externalId} value={game.official.externalId}>
                  vs {game.opponent} · {sideLabel(game.side === "home")} · {whenLabel(game.official.date)}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" size="sm" disabled={busy}>
            <Link2 className="h-4 w-4" />
            Collega e aggiorna
          </Button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={friendlyAction}>
          <input type="hidden" name="matchId" value={match.id} />
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            È un&apos;amichevole
          </Button>
        </form>
        <form action={deleteMatchAction}>
          <input type="hidden" name="id" value={match.id} />
          <input type="hidden" name="returnTo" value="/admin/partite/portale" />
          <ConfirmSubmitButton
            confirmMessage={`Eliminare la partita vs ${match.opponent}? Sparisce dal calendario insieme a convocazioni e formazioni.`}
            variant="danger-ghost"
            size="sm"
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </ConfirmSubmitButton>
        </form>
      </div>
      <Feedback states={[linkState, friendlyState]} />
    </li>
  );
}

/** «Da verificare»: le situazioni in cui serve una scelta, ognuna con la sua domanda. */
export function CheckGroup({
  games,
  orphans,
  linkableByCategory,
}: {
  games: PortalGame[];
  orphans: { category: Category; orphan: OrphanMatch }[];
  linkableByCategory: Record<Category, PortalGame[]>;
}) {
  return (
    <List>
      <ul className="divide-y divide-border">
        {games.map((game) => {
          const key = `${game.category}-${game.official.externalId}`;
          if (game.status === "conflict") return <ConflictRow key={key} game={game} />;
          if (game.status === "maybe-same") return <MaybeSameRow key={key} game={game} />;
          if (game.status === "played-missing") return <PlayedMissingRow key={key} game={game} />;
          return null;
        })}
        {orphans.map(({ category, orphan }) => (
          <OrphanRow
            key={orphan.match.id}
            category={category}
            orphan={orphan}
            linkable={linkableByCategory[category]}
          />
        ))}
      </ul>
    </List>
  );
}
