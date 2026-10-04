"use client";

import { useActionState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { Proposal } from "@/lib/federation/proposals";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import type { Match } from "@/lib/types";
import {
  applyOfficialResultAction,
  dismissOfficialResultAction,
  restoreOfficialResultAction,
  type OfficialResultFormState,
} from "./official-actions";

const initialState: OfficialResultFormState = {};

function whenLabel(iso: string): string {
  return `${format(parseISO(iso.slice(0, 10)), "EEE d MMM", { locale: it })} · ore ${iso.slice(11, 16)}`;
}

function setsLine(sets: { a: number; b: number }[]): string {
  return sets.map((set) => `${set.a}-${set.b}`).join(" · ");
}

function siteMatchLabel(match: Match): string {
  return `vs ${match.opponent} · ${whenLabel(match.matchDate)} · ${match.isHome ? "in casa" : "in trasferta"}`;
}

function Feedback({ state }: { state: OfficialResultFormState }) {
  if (state.error) return <p className="mt-2 text-sm font-medium text-destructive">{state.error}</p>;
  if (state.message) return <p className="mt-2 text-sm font-medium text-success">{state.message}</p>;
  return null;
}

/** Una gara ufficiale con il suo risultato e ciò che un admin può farne:
 * confermare (compila i parziali), ignorare, abbinare a una partita o, se
 * ignorata in precedenza, ripristinare. Nulla viene scritto senza un clic. */
export function OfficialProposalRow({ proposal, dismissed = false }: { proposal: Proposal; dismissed?: boolean }) {
  const { official, category, result, kind, match, candidates } = proposal;
  const [applyState, applyAction, applyPending] = useActionState(applyOfficialResultAction, initialState);
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissOfficialResultAction, initialState);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreOfficialResultAction, initialState);
  const busy = applyPending || dismissPending || restorePending;

  const officialSets = official.sets?.map((set) => ({ a: set.home, b: set.away })) ?? null;
  const ourSets = result.sets?.map((set) => ({ a: set.us, b: set.them })) ?? null;
  const mySets = match?.setScores?.map((set) => ({ a: set.us, b: set.them })) ?? null;

  const hidden = (
    <>
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="externalId" value={official.externalId} />
    </>
  );

  return (
    <li
      className="px-4 py-4 sm:px-5"
      data-official-game={official.externalId}
      data-official-state={dismissed ? "dismissed" : "proposal"}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Badge tone={category === "U14" ? "u14" : "u15"}>{CATEGORY_LABELS[category]}</Badge>
        <span>
          {whenLabel(official.date)} · Gara {official.externalId}
          {official.round !== null && ` · giornata ${official.round}`}
        </span>
        {official.status && <Badge tone="neutral">{official.status}</Badge>}
      </div>

      <p className="mt-2 font-display text-base font-bold leading-snug text-foreground">
        {official.home}{" "}
        <span className="tabular mx-1">
          {official.homeSets}–{official.awaySets}
        </span>{" "}
        {official.away}
      </p>
      {officialSets ? (
        <p className="tabular mt-0.5 text-sm text-muted-foreground">{setsLine(officialSets)}</p>
      ) : (
        <p className="mt-0.5 text-sm text-muted-foreground">Parziali non ancora pubblicati dal portale.</p>
      )}

      {dismissed ? (
        <form action={restoreAction} className="mt-3">
          {hidden}
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            <RotateCcw className="h-4 w-4" />
            Ripristina
          </Button>
          <Feedback state={restoreState} />
        </form>
      ) : (
        <>
          {kind === "new" && match && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-foreground/80">
                Partita nel sito: <span className="font-semibold">{siteMatchLabel(match)}</span>
              </p>
              <form action={applyAction}>
                {hidden}
                <input type="hidden" name="matchId" value={match.id} />
                <Button type="submit" size="sm" disabled={busy}>
                  <Check className="h-4 w-4" />
                  Conferma risultato
                </Button>
              </form>
              <form action={dismissAction}>
                {hidden}
                <Button type="submit" variant="outline" size="sm" disabled={busy}>
                  <X className="h-4 w-4" />
                  Ignora
                </Button>
              </form>
            </div>
          )}

          {kind === "conflict" && match && (
            <div className="mt-3 rounded-xl bg-warning-soft px-4 py-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" />
                Nel sito hai scritto un risultato diverso: resta il tuo.
              </p>
              <p className="mt-1 text-foreground/80">{siteMatchLabel(match)}</p>
              <dl className="tabular mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-foreground/85">
                <dt className="font-semibold">Il tuo</dt>
                <dd>
                  {match.resultSetsWon}–{match.resultSetsLost}
                  {mySets && <span className="ml-2 text-muted-foreground">{setsLine(mySets)}</span>}
                </dd>
                <dt className="font-semibold">Ufficiale</dt>
                <dd>
                  {result.us}–{result.them}
                  {ourSets && <span className="ml-2 text-muted-foreground">{setsLine(ourSets)}</span>}
                </dd>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={dismissAction}>
                  {hidden}
                  <Button type="submit" size="sm" disabled={busy}>
                    <Check className="h-4 w-4" />
                    Tieni il mio
                  </Button>
                </form>
                {result.sets && (
                  <form action={applyAction}>
                    {hidden}
                    <input type="hidden" name="matchId" value={match.id} />
                    <input type="hidden" name="overwrite" value="1" />
                    <Button type="submit" variant="outline" size="sm" disabled={busy}>
                      Usa quello ufficiale
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}

          {kind === "no-sets" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-foreground/80">
                Il portale ha pubblicato solo il risultato: appena inseriscono i parziali potrai confermarlo.
              </p>
              <form action={dismissAction}>
                {hidden}
                <Button type="submit" variant="outline" size="sm" disabled={busy}>
                  <X className="h-4 w-4" />
                  Ignora
                </Button>
              </form>
            </div>
          )}

          {kind === "unmatched" && (
            <div className="mt-3">
              <p className="text-sm text-foreground/80">Nessuna partita del sito abbinata a questa gara.</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {candidates.length > 0 && official.sets ? (
                  <form action={applyAction} className="flex flex-wrap items-end gap-2">
                    {hidden}
                    <label className="flex min-w-[14rem] flex-col gap-1 text-xs font-semibold text-muted-foreground">
                      Abbina a una partita del sito
                      <Select
                        name="matchId"
                        required
                        defaultValue=""
                        className="h-9 text-sm font-normal text-foreground"
                      >
                        <option value="" disabled>
                          Scegli la partita…
                        </option>
                        {candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {siteMatchLabel(candidate)}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <Button type="submit" size="sm" disabled={busy}>
                      <Check className="h-4 w-4" />
                      Abbina e conferma
                    </Button>
                  </form>
                ) : (
                  <Link
                    href="/admin/partite/nuovo"
                    className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Crea la partita
                  </Link>
                )}
                <form action={dismissAction}>
                  {hidden}
                  <Button type="submit" variant="outline" size="sm" disabled={busy}>
                    <X className="h-4 w-4" />
                    Ignora
                  </Button>
                </form>
              </div>
            </div>
          )}

          <Feedback state={applyState.error || applyState.message ? applyState : dismissState} />
        </>
      )}
    </li>
  );
}
