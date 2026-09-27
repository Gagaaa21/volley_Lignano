import type { Metadata } from "next";
import { MapPin, Target, Trophy } from "lucide-react";
import { getActiveRepo, getRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { matchTitle } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import { computeLeaderboard, computeMatchResults, isMatchLocked } from "@/lib/predictions";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import type { MatchPrediction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pronostici",
};

export default async function PronosticiPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);

  const [repo, staffRepo] = await Promise.all([getActiveRepo(), getRepo()]);
  const [matches, allPredictions, staff] = await Promise.all([
    repo.listMatches({ team }),
    repo.listPredictions(),
    staffRepo.listStaff(),
  ]);

  // I tornei non hanno un singolo "noi vs loro" a cui applicare un pronostico.
  const predictable = matches.filter((m) => !m.isTournament);
  const nameById = new Map(staff.map((s) => [s.id, s.fullName]));

  const predictionsByMatch = new Map<string, MatchPrediction[]>();
  for (const prediction of allPredictions) {
    const list = predictionsByMatch.get(prediction.matchId) ?? [];
    list.push(prediction);
    predictionsByMatch.set(prediction.matchId, list);
  }

  const withResult = predictable.filter((m) => m.setScores && m.setScores.length > 0);
  const upcoming = predictable.filter((m) => !isMatchLocked(m.matchDate));
  const lockedNoResult = predictable.filter(
    (m) => isMatchLocked(m.matchDate) && !(m.setScores && m.setScores.length > 0),
  );

  const leaderboard = computeLeaderboard(withResult, predictionsByMatch);

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Pronostici</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Pronostica il punteggio di ogni set prima che si giochi: chi si avvicina di più vince il set. A fine
          stagione vince chi ha totalizzato più punti.
        </p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-sand-600" />
            Classifica
          </h2>
        </CardHeader>
        <CardBody>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun set ancora giudicato: la classifica si popola man mano che arrivano i risultati.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {leaderboard.map((entry, i) => (
                <li
                  key={entry.staffId}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 odd:bg-surface-muted/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sea-100 text-xs font-bold text-sea-800">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-foreground">
                      {nameById.get(entry.staffId) ?? "Utente rimosso"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground/70">
                    {entry.points} {entry.points === 1 ? "punto" : "punti"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-foreground">Da pronosticare</h2>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-10 text-center text-sm text-foreground/50">
            Nessuna partita in programma al momento.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {upcoming.map((match) => {
              const matchPredictions = predictionsByMatch.get(match.id) ?? [];
              const mine = matchPredictions.find((p) => p.staffId === session.sub);
              const count = matchPredictions.length;
              return (
                <Card key={match.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
                      <p className="mt-1 text-sm text-foreground/60">
                        {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground/50">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{match.location}</span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/45">
                        {count === 0 ? "Nessun pronostico ancora" : `${count} pronostic${count === 1 ? "o" : "i"}`}
                      </p>
                    </div>
                    <LinkButton href={`/admin/pronostici/${match.id}`} variant={mine ? "outline" : "primary"} size="sm">
                      <Target className="h-3.5 w-3.5" />
                      {mine ? "Modifica pronostico" : "Pronostica"}
                    </LinkButton>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {lockedNoResult.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground">In attesa del risultato</h2>
          <div className="mt-3 space-y-3">
            {lockedNoResult.map((match) => (
              <Card key={match.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {formatDateLong(match.matchDate.slice(0, 10))} · {match.matchDate.slice(11, 16)}
                    </p>
                  </div>
                  <LinkButton href={`/admin/pronostici/${match.id}`} variant="outline" size="sm">
                    Vedi pronostici
                  </LinkButton>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {withResult.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground">Risultati</h2>
          <div className="mt-3 space-y-3">
            {withResult.map((match) => {
              const results = computeMatchResults(match, predictionsByMatch.get(match.id) ?? []);
              const hasAnyPrediction = results?.some((r) => r.rankings.length > 0) ?? false;
              return (
                <Card key={match.id}>
                  <CardHeader>
                    <p className="font-display text-base font-bold text-foreground">{matchTitle(match)}</p>
                    <p className="mt-1 text-sm text-foreground/60">{formatDateLong(match.matchDate.slice(0, 10))}</p>
                  </CardHeader>
                  <CardBody>
                    {!results || !hasAnyPrediction ? (
                      <p className="text-sm text-muted-foreground">Nessun pronostico per questa partita.</p>
                    ) : (
                      <div className="space-y-2">
                        {results
                          .filter((r) => r.rankings.length > 0)
                          .map((r) => (
                            <div key={r.setIndex} className="rounded-xl border border-border-subtle px-3.5 py-2.5">
                              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                                Set {r.setIndex + 1} · {r.actual.us}-{r.actual.them}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {r.rankings.map((entry) => (
                                  <span
                                    key={entry.staffId}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                                      entry.isWinner
                                        ? "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]"
                                        : "bg-surface-muted text-foreground/60",
                                    )}
                                  >
                                    {entry.isWinner && <Trophy className="h-3 w-3" />}
                                    {nameById.get(entry.staffId) ?? "Utente rimosso"}: {entry.predicted.us}-
                                    {entry.predicted.them}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
