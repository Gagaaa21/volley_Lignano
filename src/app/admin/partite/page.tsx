import type { Metadata } from "next";
import Link from "next/link";
import { Home, MapPin, Pencil, Plane, Plus } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { CATEGORY_BADGE, CATEGORY_LABELS } from "@/lib/category";
import { cn } from "@/lib/cn";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import type { Category } from "@/lib/types";
import { deleteMatchAction } from "./actions";

export const metadata: Metadata = {
  title: "Partite",
};

export default async function MatchesListPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const activeCategory: "all" | Category = cat === "U14" || cat === "U15" ? cat : "all";

  const repo = await getActiveRepo();
  const matches = await repo.listMatches(
    activeCategory === "all" ? undefined : { category: activeCategory },
  );
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Partite</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Gestisci le partite di campionato per Under 14 e Under 15.
          </p>
        </div>
        <LinkButton href="/admin/partite/nuovo">
          <Plus className="h-4 w-4" />
          Nuova partita
        </LinkButton>
      </div>

      <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-sm shadow-sea-950/5">
        {(["all", "U14", "U15"] as const).map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/partite" : `/admin/partite?cat=${value}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              activeCategory === value
                ? "bg-sea-700 text-white shadow-sm"
                : "text-foreground/60 hover:bg-surface-muted",
            )}
          >
            {value === "all" ? "Tutte" : CATEGORY_LABELS[value]}
          </Link>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna partita in programma.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {matches.map((match) => {
            const isPast = match.matchDate.slice(0, 10) < todayStr;
            return (
              <Card key={match.id} className={cn(isPast && "opacity-60")}>
                <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={CATEGORY_BADGE[match.category]}>
                        {CATEGORY_LABELS[match.category]}
                      </Badge>
                      {match.isFriendly && (
                        <Badge className="bg-foreground/8 text-foreground/60">Amichevole</Badge>
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
                      ) : (
                        isPast && <Badge className="bg-foreground/10 text-foreground/50">Disputata</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 font-display text-base font-bold text-foreground">
                      vs {match.opponent}
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/50">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{match.location}</span>
                    </p>
                    {match.setScores && match.setScores.length > 0 && (
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
                        confirmMessage={`Eliminare la partita vs ${match.opponent}?`}
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
