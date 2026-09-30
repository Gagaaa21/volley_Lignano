"use client";

import { useMemo, useState } from "react";
import { Home, MapPin, Pencil, Plane, Search } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import { CATEGORY_LABELS, categoryBadgeClass, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { cn } from "@/lib/cn";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import type { Match } from "@/lib/types";
import { deleteMatchAction } from "./actions";

/** Elenco partite con ricerca (mostrata solo oltre 5 partite, stesso
 * limite già usato altrove) sull'avversario e sul luogo. */
export function MatchList({ matches }: { matches: Match[] }) {
  const [query, setQuery] = useState("");
  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) => m.opponent.toLowerCase().includes(q) || m.location.toLowerCase().includes(q),
    );
  }, [matches, query]);

  return (
    <div>
      {matches.length > 5 && (
        <div className="relative mt-5 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per avversario o luogo…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary/40 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna partita trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="mt-6 space-y-3" data-tour="section-partite-cards">
          {filtered.map((match) => {
            const isPast = match.matchDate.slice(0, 10) < todayStr;
            return (
              <Card key={match.id} className={cn(isPast && "opacity-60")}>
                <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={categoryBadgeClass(match.category)}>
                        {match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL}
                      </Badge>
                      {match.isFriendly && (
                        <Badge className="bg-foreground/8 text-foreground/60">Amichevole</Badge>
                      )}
                      {match.isTournament && (
                        <Badge className="bg-foreground/8 text-foreground/60">Torneo</Badge>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/50">
                        {match.isHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
                        {match.isHome ? "Casa" : "Trasferta"}
                      </span>
                      {match.resultSetsWon !== null && match.resultSetsLost !== null ? (
                        <Badge
                          className={
                            match.resultSetsWon > match.resultSetsLost
                              ? "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]"
                              : "bg-destructive/10 text-destructive"
                          }
                        >
                          {match.resultSetsWon > match.resultSetsLost ? "Vinta" : "Persa"}{" "}
                          {match.resultSetsWon}-{match.resultSetsLost}
                        </Badge>
                      ) : match.isTournament && match.tournamentGames?.some((g) => g.setScores.length > 0) ? (
                        <Badge className="bg-foreground/10 text-foreground/60">Risultato registrato</Badge>
                      ) : (
                        isPast && <Badge className="bg-foreground/10 text-foreground/50">Disputata</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 font-display text-base font-bold text-foreground">
                      {matchTitle(match)}
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/50">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{match.location}</span>
                    </p>
                    {match.isTournament
                      ? match.tournamentGames &&
                        match.tournamentGames.some((g) => g.setScores.length > 0) && (
                          <p className="mt-1 text-xs text-foreground/45">
                            {match.tournamentGames
                              .filter((g) => g.setScores.length > 0)
                              .map((g) => `vs ${g.opponent}: ${g.setScores.map((s) => `${s.us}-${s.them}`).join(", ")}`)
                              .join(" · ")}
                          </p>
                        )
                      : match.setScores &&
                        match.setScores.length > 0 && (
                          <p className="mt-1 text-xs text-foreground/45">
                            {match.setScores.map((s) => `${s.us}-${s.them}`).join(", ")}
                          </p>
                        )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <LinkButton href={`/admin/partite/${match.id}`} variant="outline" size="sm">
                      <Pencil className="h-3.5 w-3.5" />
                      Modifica
                    </LinkButton>
                    <form action={deleteMatchAction}>
                      <input type="hidden" name="id" value={match.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Eliminare la partita ${matchTitle(match)}?`}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/8"
                      >
                        Elimina
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
