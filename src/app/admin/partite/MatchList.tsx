"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronRight, Home, MapPin, Plane } from "lucide-react";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_LABELS, categoryDotClass, MATCH_NO_CATEGORY_LABEL } from "@/lib/category";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeading } from "@/components/ui/PageHeader";
import type { Match } from "@/lib/types";

function ResultBlock({ match, isPast }: { match: Match; isPast: boolean }) {
  if (match.resultSetsWon !== null && match.resultSetsLost !== null && !match.isTournament) {
    const won = match.resultSetsWon > match.resultSetsLost;
    return (
      <div className="flex shrink-0 flex-col items-end">
        <span className={cn("display-wide tabular text-[1.5rem] leading-none", won ? "text-success" : "text-foreground/70")}>
          {match.resultSetsWon}–{match.resultSetsLost}
        </span>
        <span className={cn("mt-1 text-[11px] font-bold uppercase tracking-[0.06em]", won ? "text-success" : "text-destructive")}>
          {won ? "Vinta" : "Persa"}
        </span>
      </div>
    );
  }
  if (match.isTournament && match.tournamentGames?.some((g) => g.setScores.length > 0)) {
    return <Badge tone="neutral">Risultati inseriti</Badge>;
  }
  if (isPast) {
    return <span className="shrink-0 text-xs font-semibold text-warning">Risultato da inserire</span>;
  }
  return null;
}

function MatchRow({ match, isPast }: { match: Match; isPast: boolean }) {
  const date = parseISO(match.matchDate.slice(0, 10));
  const setScores = match.isTournament
    ? null
    : match.setScores && match.setScores.length > 0
      ? match.setScores.map((s) => `${s.us}-${s.them}`).join("  ")
      : null;
  return (
    <Link
      href={`/admin/partite/${match.id}`}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:px-5"
    >
      <span className="w-11 shrink-0 text-center">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {format(date, "EEE", { locale: it })}
        </span>
        <span className="display-wide tabular block text-[1.375rem] leading-7 text-foreground">{format(date, "d")}</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {format(date, "MMM", { locale: it })}
        </span>
      </span>
      <span className={cn("w-1 self-stretch rounded-full", categoryDotClass(match.category))} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
          <span className="text-foreground/75">
            {match.category ? CATEGORY_LABELS[match.category] : MATCH_NO_CATEGORY_LABEL}
          </span>
          <span className="inline-flex items-center gap-1">
            {match.isHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
            {match.isHome ? "Casa" : "Trasferta"}
          </span>
          {match.isFriendly && <Badge className="py-0 text-[11px]">Amichevole</Badge>}
          {match.isTournament && (
            <Badge tone="gold" className="py-0 text-[11px]">
              Torneo
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block truncate font-semibold text-foreground group-hover:text-primary">
          {matchTitle(match)}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="tabular shrink-0 font-semibold text-foreground/75">{match.matchDate.slice(11, 16)}</span>
          <MapPin className="ml-1 h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{match.location}</span>
        </span>
        {setScores && <span className="tabular mt-1 block text-xs text-muted-foreground">Parziali: {setScores}</span>}
      </span>
      <ResultBlock match={match} isPast={isPast} />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Elenco partite diviso in "In programma" (dalla più vicina) e "Giocate"
 * (dalla più recente), con ricerca su avversario e luogo oltre 5 partite.
 * Ogni riga apre la partita, dove si trova anche l'eliminazione. */
export function MatchList({ matches }: { matches: Match[] }) {
  const [query, setQuery] = useState("");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((m) => m.opponent.toLowerCase().includes(q) || m.location.toLowerCase().includes(q));
  }, [matches, query]);

  const upcoming = filtered
    .filter((m) => m.matchDate.slice(0, 10) >= todayStr)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  const past = filtered
    .filter((m) => m.matchDate.slice(0, 10) < todayStr)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate));

  return (
    <div>
      {matches.length > 5 && (
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per avversario o luogo…"
          className="mb-5"
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessuna partita trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="space-y-8" data-tour="section-partite-cards">
          {upcoming.length > 0 && (
            <section>
              <SectionHeading title="In programma" action={<span className="text-[13px] text-muted-foreground">{upcoming.length}</span>} />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {upcoming.map((match) => (
                  <MatchRow key={match.id} match={match} isPast={false} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <SectionHeading title="Giocate" action={<span className="text-[13px] text-muted-foreground">{past.length}</span>} />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {past.map((match) => (
                  <MatchRow key={match.id} match={match} isPast />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
