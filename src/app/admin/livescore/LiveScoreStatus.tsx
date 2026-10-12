"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, Flag, Pencil, Shuffle, Trophy, Undo2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { currentServerName, nextServer } from "@/lib/lineup";
import {
  closeSet,
  currentSet,
  currentSetTarget,
  matchPointFor,
  matchWinner,
  needsFirstServer,
  otherKey,
  setPointFor,
  sideChangeNeeded,
  suggestedSetEnd,
  teamKeyProp,
  type TeamKey,
} from "@/lib/liveScore";
import type { LiveScoreState } from "@/lib/types";
import { displayLabel, getTeamAccent } from "./accent";

/** Chi gioca in una posizione, scritto come lo si legge a bordo campo: «n. 7» in Partita, il nome in Allenamento. */
function playerText(name: string, numeric: boolean): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return numeric ? `n. ${trimmed}` : trimmed;
}

function TeamDot({ match, teamKey }: { match: LiveScoreState; teamKey: TeamKey }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface"
      style={{ background: getTeamAccent(teamKey, match.mode, match.opponentColor).dot }}
    />
  );
}

function Chip({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Striscia sotto il tabellone: a che set si è e a quanti punti finisce, chi
 * batte adesso (e con quale giocatrice), chi batterebbe se ricevesse e vincesse
 * lo scambio, e quando una squadra ha il set point o il match point. È ciò che
 * serve per non perdere il filo della rotazione, senza contare a mente.
 */
export function StatusStrip({ match, numeric }: { match: LiveScoreState; numeric: boolean }) {
  if (matchWinner(match)) return null;
  const set = currentSet(match);
  const target = currentSetTarget(match);
  const serving = match.servingTeam;
  const servingTeam = serving ? match[teamKeyProp(serving)] : null;
  const receiving = serving ? otherKey(serving) : null;
  const receivingTeam = receiving ? match[teamKeyProp(receiving)] : null;
  const server = servingTeam ? playerText(currentServerName(servingTeam), numeric) : "";
  const next = receivingTeam ? playerText(nextServer(receivingTeam), numeric) : "";
  const setPoint = setPointFor(match);
  const matchPoint = matchPointFor(match);
  const pointKey = matchPoint ?? setPoint;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5" data-livescore-status data-tour="section-livescore-status">
      <Chip data-livescore-set>
        <Flag className="h-3 w-3 text-muted-foreground" />
        {set}° set{target !== null && <span className="font-medium text-muted-foreground">· si vince a {target}</span>}
      </Chip>
      {match.withLineup && serving && servingTeam && (
        <Chip data-livescore-serving className="border-green-600/40 bg-green-50 text-green-900">
          <Volleyball className="h-3.5 w-3.5 text-green-700" />
          <TeamDot match={match} teamKey={serving} />
          Batte {displayLabel(servingTeam, serving)}
          {server && <b className="font-bold">{server}</b>}
        </Chip>
      )}
      {match.withLineup && receiving && receivingTeam && next && (
        <Chip data-livescore-next className="text-muted-foreground">
          Se vince {displayLabel(receivingTeam, receiving)}, batte <b className="font-bold text-foreground">{next}</b>
        </Chip>
      )}
      {pointKey && (
        <Chip
          data-livescore-setpoint
          className="border-transparent font-bold uppercase tracking-wide"
          style={{
            background: getTeamAccent(pointKey, match.mode, match.opponentColor).background,
            color: getTeamAccent(pointKey, match.mode, match.opponentColor).text,
          }}
        >
          {matchPoint ? "Match point" : "Set point"} · {displayLabel(match[teamKeyProp(pointKey)], pointKey)}
        </Chip>
      )}
    </div>
  );
}

/** Scheda grande e ben visibile, sopra i pulsanti dei punti. */
function Card({
  children,
  tone = "neutral",
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: "neutral" | "attention" | "success";
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "shrink-0 rounded-2xl border px-4 py-3",
        tone === "attention" && "border-amber-500/50 bg-amber-50 text-amber-950",
        tone === "success" && "border-green-600/40 bg-green-50 text-green-950",
        tone === "neutral" && "border-border-subtle bg-surface text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Il set è finito per regolamento (limite raggiunto con due punti di scarto):
 * un solo tocco lo chiude e prepara il set dopo, oppure si annulla l'ultimo
 * punto se era sbagliato. I pulsanti dei punti restano fermi finché non si sceglie.
 */
export function SetEndCard({
  match,
  onClose,
  onUndo,
}: {
  match: LiveScoreState;
  onClose: () => void;
  onUndo: () => void;
}) {
  const winner = suggestedSetEnd(match);
  if (!winner) return null;
  const winnerTeam = match[teamKeyProp(winner)];
  const loserTeam = match[teamKeyProp(otherKey(winner))];
  // Chiudere questo set decide la partita?
  const decidesMatch = matchWinner(closeSet(match)) !== null;
  return (
    <Card tone="success" data-livescore-set-end role="status">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Trophy className="h-5 w-5 shrink-0 text-green-700" />
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-tight">
              {displayLabel(winnerTeam, winner)} vince il {currentSet(match)}° set
              <span className="ml-2 tabular-nums">
                {winnerTeam.score}–{loserTeam.score}
              </span>
            </p>
            <p className="text-[13px] text-green-900/80">
              {decidesMatch ? "Chiudi il set per chiudere la partita." : "Chiudi il set per passare al successivo: campi, battuta e formazioni si preparano da soli."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onUndo}>
            <Undo2 className="h-3.5 w-3.5" />
            Annulla ultimo punto
          </Button>
          <Button onClick={onClose} data-livescore-close-set>
            <Flag className="h-4 w-4" />
            Chiudi il set
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Nel set decisivo, a 8 punti, si cambia campo. */
export function SideChangeCard({ match, onChange }: { match: LiveScoreState; onChange: () => void }) {
  if (!sideChangeNeeded(match)) return null;
  return (
    <Card tone="attention" data-livescore-side-change role="status">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
          Cambio campo: nel set decisivo si cambia quando una squadra arriva a 8 punti.
        </p>
        <Button size="sm" onClick={onChange}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Cambia campo
        </Button>
      </div>
    </Card>
  );
}

/**
 * Inizio di ogni set (0-0): chi batte per primo, con la scelta già fatta come
 * da regolamento (la battuta si alterna a ogni set) e correggibile con un
 * tocco, la formazione di partenza e il campo. Nel set decisivo la battuta si
 * sorteggia: la scelta è obbligatoria e finché non è fatta i punti restano fermi.
 */
export function SetStartCard({
  match,
  numeric,
  editingLineups,
  onChoose,
  onToggleLineups,
  savedLineup,
}: {
  match: LiveScoreState;
  numeric: boolean;
  editingLineups: boolean;
  onChoose: (key: TeamKey) => void;
  onToggleLineups: () => void;
  /** Se c'è una formazione salvata per questo set, il pulsante per usarla. */
  savedLineup?: { label: string; onUse: () => void } | null;
}) {
  const toss = needsFirstServer(match);
  const set = currentSet(match);
  const swapped = set > 1;
  const first = match.servingTeam;
  const firstTeam = first ? match[teamKeyProp(first)] : null;
  const serverName = firstTeam ? playerText(currentServerName(firstTeam), numeric) : "";
  return (
    <Card tone={toss ? "attention" : "neutral"} data-livescore-set-start role="group" aria-label={`Inizio del ${set}° set`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-base font-bold leading-tight">
            {toss ? <Shuffle className="h-4 w-4 shrink-0" /> : <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />}
            {toss ? `${set}° set (decisivo): sorteggio` : `${set}° set: pronti a partire`}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {toss
              ? "Scegli chi batte per primo. Se al sorteggio i campi cambiano, usa «Inverti». I punti si sbloccano dopo la scelta."
              : [
                  swapped ? "Campi invertiti, formazioni di partenza ripristinate." : null,
                  first && firstTeam
                    ? `Batte per primo ${displayLabel(firstTeam, first)}${serverName ? `: ${serverName}` : ""}${set > 1 ? " (la battuta si alterna a ogni set)" : ""}.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground/80">Batte per primo</span>
          <div className="flex gap-1.5" role="group" aria-label="Chi batte per primo">
            {(["A", "B"] as const).map((key) => {
              const selected = match.servingTeam === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChoose(key)}
                  aria-pressed={selected}
                  data-livescore-first-server={key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : toss
                        ? "border-amber-600/50 bg-white text-foreground hover:bg-amber-100"
                        : "border-border-subtle text-foreground/70 hover:bg-muted",
                  )}
                >
                  <TeamDot match={match} teamKey={key} />
                  {displayLabel(match[teamKeyProp(key)], key)}
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={onToggleLineups} data-livescore-check-lineups>
            <Pencil className="h-3.5 w-3.5" />
            {editingLineups ? "Fatto" : "Controlla formazioni"}
          </Button>
          {savedLineup && (
            <Button variant="outline" size="sm" onClick={savedLineup.onUse} data-livescore-use-saved>
              {savedLineup.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
