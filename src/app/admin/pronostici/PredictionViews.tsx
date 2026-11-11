import { Star, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import {
  predictedOutcome,
  rankPositions,
  scoreSets,
  type LeaderboardEntry,
  type MatchSetResult,
  type SetRankingEntry,
} from "@/lib/predictions";
import type { MatchPrediction, SetScore, TournamentGame } from "@/lib/types";

/**
 * Come si vedono i Pronostici: il pronostico in breve (risultato previsto e set), la tabella pronostici contro risultato
 * con i punti di ognuno, chi ha già pronosticato (solo i nomi finché sono aperti) e la classifica. Condivisi tra l'elenco
 * e la scheda della partita.
 */

const nameOf = (nameById: Map<string, string>, staffId: string) => nameById.get(staffId) ?? "Utente rimosso";

function MeBadge() {
  return <span className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary-foreground">tu</span>;
}

/** Un pronostico in breve: il risultato previsto («3–1») e i set, con quelli vinti da Lignano in verde. */
export function PredictedSets({ sets }: { sets: SetScore[] }) {
  const { won, lost } = predictedOutcome(sets);
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-predicted-sets>
      <span className="tabular rounded-md bg-foreground px-1.5 py-0.5 text-xs font-bold text-background">
        {won}–{lost}
      </span>
      {sets.map((set, i) => (
        <span
          key={i}
          className={cn(
            "tabular rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1",
            set.us > set.them ? "bg-success-soft text-success ring-success/20" : "bg-muted text-muted-foreground ring-border",
          )}
        >
          {set.us}–{set.them}
        </span>
      ))}
    </span>
  );
}

/** Il pronostico di un torneo in breve: per ogni gara l'avversaria e i set. */
export function PredictedTournament({ games }: { games: TournamentGame[] }) {
  return (
    <span className="flex flex-col gap-1">
      {games.map((game) => (
        <span key={game.id} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground/80">vs {game.opponent}</span>
          <PredictedSets sets={game.setScores} />
        </span>
      ))}
    </span>
  );
}

/** Il pronostico di una persona, normale o torneo. */
export function PredictionSummary({ prediction }: { prediction: Pick<MatchPrediction, "setScores" | "tournamentGames"> }) {
  if (prediction.tournamentGames && prediction.tournamentGames.length > 0) return <PredictedTournament games={prediction.tournamentGames} />;
  return <PredictedSets sets={prediction.setScores ?? []} />;
}

/** Chi ha già pronosticato, solo i nomi: i punteggi degli altri restano nascosti finché i pronostici sono aperti. */
export function WhoPredicted({ staffIds, nameById, meId }: { staffIds: string[]; nameById: Map<string, string>; meId: string }) {
  if (staffIds.length === 0) return <p className="text-sm text-muted-foreground">Ancora nessuno: sii il primo!</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" data-who-predicted>
      {staffIds.map((staffId) => (
        <li key={staffId} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted py-1 pl-1 pr-2.5 text-xs font-semibold text-foreground ring-1 ring-border">
          <Avatar name={nameOf(nameById, staffId)} size="sm" tone={staffId === meId ? "primary" : "neutral"} className="h-6 w-6 text-[9px]" />
          {nameOf(nameById, staffId)}
          {staffId === meId && <MeBadge />}
        </li>
      ))}
    </ul>
  );
}

/** Una casella della tabella: il pronostico di quel set, colorato da come è andato. */
function ResultCell({ entry }: { entry: SetRankingEntry | undefined }) {
  if (!entry) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold",
        entry.isWinner
          ? "bg-sand-400 text-sea-950 shadow-xs"
          : entry.correctWinner
            ? "text-foreground"
            : "text-muted-foreground/70",
      )}
      data-prediction-cell={entry.isWinner ? "winner" : entry.correctWinner ? "right" : "wrong"}
      title={
        entry.isWinner
          ? entry.exactMatch
            ? "Punteggio esatto: 1 punto"
            : "Il più vicino: 1 punto"
          : entry.correctWinner
            ? "Vincitore del set indovinato"
            : "Vincitore del set sbagliato"
      }
    >
      {entry.isWinner && (entry.exactMatch ? <Star className="h-3 w-3 fill-current" /> : <Trophy className="h-3 w-3" />)}
      {entry.predicted.us}–{entry.predicted.them}
    </span>
  );
}

/** Spiega i colori della tabella, sotto di lei. */
export function ResultLegend() {
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-0.5 rounded bg-sand-400 px-1 font-semibold text-sea-950">
          <Trophy className="h-2.5 w-2.5" />
        </span>
        il più vicino: 1 punto
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center rounded bg-sand-400 px-1 text-sea-950">
          <Star className="h-2.5 w-2.5 fill-current" />
        </span>
        punteggio esatto
      </span>
      <span>
        <span className="font-semibold text-foreground">nero</span>: vincitore del set indovinato
      </span>
      <span>
        <span className="font-semibold text-muted-foreground/70">grigio</span>: sbagliato
      </span>
    </p>
  );
}

/**
 * La tabella di una partita con il risultato: una riga per persona (prima chi ha fatto più punti), una colonna per set
 * con il punteggio vero in alto, il pronostico in ogni casella e i punti presi in fondo alla riga.
 */
export function ResultTable({
  sets,
  nameById,
  meId,
  label,
}: {
  sets: MatchSetResult[];
  nameById: Map<string, string>;
  meId: string;
  label?: string;
}) {
  const scores = scoreSets(sets);
  const positions = rankPositions(scores);
  if (scores.length === 0) return <p className="text-sm text-muted-foreground">Nessun pronostico per questa partita.</p>;
  const columns = { gridTemplateColumns: `repeat(${sets.length}, minmax(0, 1fr))` };
  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-semibold text-foreground/80">{label}</p>}

      {/* Telefono: una scheda per persona (nome e punti, sotto i set allineati ai punteggi veri), così tutto sta nello schermo. */}
      <div className="sm:hidden" data-prediction-cards>
        <div className="grid gap-1 px-2" style={columns}>
          {sets.map((set) => (
            <span key={set.setIndex} className="text-center">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Set {set.setIndex + 1}</span>
              <span className="tabular block text-[13px] font-semibold text-foreground">
                {set.actual.us}–{set.actual.them}
              </span>
            </span>
          ))}
        </div>
        <ul className="mt-2 space-y-1.5">
          {scores.map((score, i) => {
            const me = score.staffId === meId;
            const top = positions[i] === 1 && score.points > 0;
            return (
              <li key={score.staffId} className={cn("rounded-xl px-2 py-2", me ? "bg-primary-soft/50" : "bg-surface-muted/70")}>
                <span className="flex items-center justify-between gap-2 px-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {top && <Trophy className="h-3.5 w-3.5 shrink-0 text-sand-600" />}
                    <span className="truncate text-sm font-semibold text-foreground">{nameOf(nameById, score.staffId)}</span>
                    {me && <MeBadge />}
                  </span>
                  <span className="tabular shrink-0">
                    <span className="font-display text-base font-bold text-foreground">{score.points}</span>
                    <span className="ml-0.5 text-[11px] text-muted-foreground">pt</span>
                  </span>
                </span>
                <span className="mt-1.5 grid gap-1" style={columns}>
                  {sets.map((set) => (
                    <span key={set.setIndex} className="text-center">
                      <ResultCell entry={set.rankings.find((entry) => entry.staffId === score.staffId)} />
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="-mx-1 hidden overflow-x-auto px-1 sm:block">
        <table className="w-full border-separate border-spacing-y-1 text-sm" data-prediction-table>
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="pb-1 text-left font-semibold">Pronostico di</th>
              {sets.map((set) => (
                <th key={set.setIndex} className="px-0.5 pb-1 text-center font-semibold">
                  <span className="block">Set {set.setIndex + 1}</span>
                  <span className="tabular mt-0.5 block text-[13px] normal-case tracking-normal text-foreground">
                    {set.actual.us}–{set.actual.them}
                  </span>
                </th>
              ))}
              <th className="pb-1 pl-1 text-right font-semibold">Punti</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score, i) => {
              const me = score.staffId === meId;
              const top = positions[i] === 1 && score.points > 0;
              return (
                <tr key={score.staffId} data-prediction-row={nameOf(nameById, score.staffId)} className={cn(me && "[&>td]:bg-primary-soft/50")}>
                  <td className="rounded-l-lg py-1.5 pl-1.5 pr-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar name={nameOf(nameById, score.staffId)} size="sm" tone={top ? "gold" : me ? "primary" : "neutral"} className="hidden h-6 w-6 text-[9px] sm:inline-flex" />
                      <span className="max-w-[6.5rem] truncate font-semibold text-foreground sm:max-w-[10rem]">{nameOf(nameById, score.staffId)}</span>
                      {me && <MeBadge />}
                    </span>
                  </td>
                  {sets.map((set) => (
                    <td key={set.setIndex} className="px-0.5 py-1.5 text-center">
                      <ResultCell entry={set.rankings.find((entry) => entry.staffId === score.staffId)} />
                    </td>
                  ))}
                  <td className="rounded-r-lg py-1.5 pl-1 pr-1.5 text-right">
                    <span className="tabular font-display text-base font-bold text-foreground" data-prediction-points>
                      {score.points}
                    </span>
                    <span className="ml-0.5 text-[11px] text-muted-foreground">pt</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Chiusi ma senza risultato: i pronostici di tutti, uno per riga, col risultato previsto. */
export function PendingPredictions({
  predictions,
  nameById,
  meId,
}: {
  predictions: MatchPrediction[];
  nameById: Map<string, string>;
  meId: string;
}) {
  const sorted = [...predictions].sort((a, b) => nameOf(nameById, a.staffId).localeCompare(nameOf(nameById, b.staffId), "it"));
  return (
    <ul className="divide-y divide-border" data-pending-predictions>
      {sorted.map((prediction) => (
        <li key={prediction.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
            <Avatar name={nameOf(nameById, prediction.staffId)} size="sm" tone={prediction.staffId === meId ? "primary" : "neutral"} className="h-7 w-7 text-[10px]" />
            <span className="truncate font-semibold text-foreground">{nameOf(nameById, prediction.staffId)}</span>
            {prediction.staffId === meId && <MeBadge />}
          </span>
          <span className="pl-9 sm:pl-0">
            <PredictionSummary prediction={prediction} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** I punti di ognuno in una partita, in breve (per l'elenco dei risultati): prima chi ne ha fatti di più. */
export function MatchPointsChips({ sets, nameById, meId }: { sets: MatchSetResult[]; nameById: Map<string, string>; meId: string }) {
  const scores = scoreSets(sets);
  const positions = rankPositions(scores);
  if (scores.length === 0) return <p className="text-sm text-muted-foreground">Nessun pronostico per questa partita.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" data-match-points>
      {scores.map((score, i) => {
        const top = positions[i] === 1 && score.points > 0;
        return (
          <li
            key={score.staffId}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              top ? "bg-sand-400 text-sea-950" : "bg-surface-muted text-foreground/80 ring-1 ring-border",
              score.staffId === meId && !top && "ring-primary/40",
            )}
          >
            {top && <Trophy className="h-3 w-3" />}
            {nameOf(nameById, score.staffId)}
            <span className="tabular font-bold">{score.points} pt</span>
          </li>
        );
      })}
    </ul>
  );
}

/** La classifica: posizione (a pari punti la stessa), nome, punti; sotto, set vinti su quelli giudicati ed esatti. */
export function Leaderboard({ entries, nameById, meId }: { entries: LeaderboardEntry[]; nameById: Map<string, string>; meId: string }) {
  const positions = rankPositions(entries);
  return (
    <ol className="divide-y divide-border" data-leaderboard>
      {entries.map((entry, i) => {
        const position = positions[i];
        const me = entry.staffId === meId;
        return (
          <li
            key={entry.staffId}
            className={cn("flex items-center gap-3 px-4 py-3", position === 1 && entry.points > 0 && "bg-accent/40", me && "bg-primary-soft/50")}
            data-leaderboard-row={nameOf(nameById, entry.staffId)}
          >
            <span
              className={cn(
                "tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                position === 1 ? "bg-sand-400 text-sea-950" : position === 2 ? "bg-muted text-foreground/80 ring-1 ring-border-strong" : position === 3 ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {position}
            </span>
            <Avatar name={nameOf(nameById, entry.staffId)} size="sm" tone={position === 1 ? "gold" : me ? "primary" : "neutral"} />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-semibold text-foreground">{nameOf(nameById, entry.staffId)}</span>
                {me && <MeBadge />}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {entry.points} set su {entry.judged}
                {entry.exact > 0 && ` · ${entry.exact} esatt${entry.exact === 1 ? "o" : "i"}`} · {entry.matches} partit{entry.matches === 1 ? "a" : "e"}
              </span>
            </span>
            <span className="tabular shrink-0 text-right">
              <span className="font-display text-xl font-bold text-foreground">{entry.points}</span>
              <span className="ml-1 text-xs text-muted-foreground">pt</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Come si fanno i punti, in poche righe (sotto la classifica). */
export function ScoringRules() {
  return (
    <details className="group mt-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-card" data-scoring-rules>
      <summary className="cursor-pointer list-none font-semibold text-foreground marker:hidden">
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-sand-600" />
          Come si fanno i punti
        </span>
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-muted-foreground">
        <li>Per ogni set giocato prende <strong className="text-foreground">1 punto</strong> chi si è avvicinato di più al punteggio vero.</li>
        <li>Conta prima il punteggio esatto, poi aver indovinato chi vinceva il set, poi quanto ci si è andati vicino (punti nostri, loro, differenza e totale).</li>
        <li>A pari merito il punto va a tutti. Un set pronosticato ma non giocato non conta.</li>
        <li>I pronostici degli altri si vedono quando si chiudono: 10 minuti dopo l&apos;inizio della partita.</li>
      </ul>
    </details>
  );
}
