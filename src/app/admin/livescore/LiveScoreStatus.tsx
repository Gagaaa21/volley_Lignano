"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, Flag, Pencil, Shuffle, Trophy, TriangleAlert, Undo2, Volleyball } from "lucide-react";
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
import { isDecidingSet, sidesChangeAfterSet } from "@/lib/volleyRules";
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
  tone?: "neutral" | "attention" | "success" | "problem";
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "shrink-0 rounded-2xl border px-4 py-3",
        tone === "attention" && "border-amber-500/50 bg-amber-50 text-amber-950",
        tone === "success" && "border-green-600/40 bg-green-50 text-green-950",
        tone === "problem" && "border-destructive/50 bg-destructive/10 text-foreground",
        tone === "neutral" && "border-border-subtle bg-surface text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * La formazione ha un numero (o un nome) scritto in due posizioni, o la libero ha il numero di chi è in campo: si
 * dice cosa correggere, squadra per squadra. Prima di «Inizia» è l'unica cosa da fare; a partita in corso il
 * pulsante porta alle formazioni.
 */
export function LineupIssuesCard({
  items,
  onFix,
}: {
  /** Un messaggio per ogni errore, col nome della squadra. */
  items: { team: string; text: string }[];
  /** Apre la correzione delle formazioni, se non è già aperta. */
  onFix?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card tone="problem" data-livescore-lineup-issues role="status">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-base font-bold leading-tight">
            <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
            Formazione da correggere
          </p>
          <ul className="mt-1 space-y-0.5 text-[13px] leading-snug">
            {items.map((item) => (
              <li key={`${item.team}-${item.text}`}>
                <b className="font-bold">{item.team}</b>: {item.text}
              </li>
            ))}
          </ul>
        </div>
        {onFix && (
          <Button variant="outline" onClick={onFix} className="border-2" data-livescore-fix-lineups>
            <Pencil className="h-4 w-4" />
            Correggi
          </Button>
        )}
      </div>
    </Card>
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
  // Il set dopo: nel decisivo campo e battuta si sorteggiano; altrimenti si cambia campo solo ogni 2 set.
  const { format } = match.rules;
  const nextIsDeciding = format !== "free" && isDecidingSet(format, currentSet(match) + 1);
  const afterText = nextIsDeciding
    ? "Chiudi il set per passare al decisivo: campo e battuta si sorteggiano, le formazioni di partenza si ripristinano da sole."
    : `Chiudi il set per passare al successivo: ${
        sidesChangeAfterSet(format, currentSet(match)) ? "le squadre cambiano campo" : "le squadre restano sugli stessi campi (si cambia ogni 2 set)"
      }, battuta e formazioni si preparano da sole.`;
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
              {decidesMatch ? "Chiudi il set per chiudere la partita." : afterText}
            </p>
          </div>
        </div>
        {/* Su telefono i due pulsanti stanno uno sotto l'altro, a tutta larghezza, con «Chiudi il set» in cima. */}
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={onUndo} className="border-2">
            <Undo2 className="h-4 w-4" />
            Annulla ultimo punto
          </Button>
          <Button size="lg" onClick={onClose} data-livescore-close-set className="text-base sm:min-w-40">
            <Flag className="h-5 w-5" />
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
        <Button size="lg" onClick={onChange} className="text-base">
          <ArrowLeftRight className="h-5 w-5" />
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
  lineupsBlocked,
  onChoose,
  onToggleLineups,
  savedLineup,
}: {
  match: LiveScoreState;
  numeric: boolean;
  editingLineups: boolean;
  /** Le formazioni hanno errori da correggere: finché ci sono non si può chiudere la correzione. */
  lineupsBlocked?: boolean;
  onChoose: (key: TeamKey) => void;
  onToggleLineups: () => void;
  /** Se c'è una formazione salvata per questo set, il pulsante per usarla. */
  savedLineup?: { label: string; onUse: () => void } | null;
}) {
  const toss = needsFirstServer(match);
  const set = currentSet(match);
  // Si cambia campo ogni 2 set: all'inizio del 3° i campi sono cambiati, al 2° no. Prima del decisivo (sorteggio) restano com'erano.
  const sidesChanged = set > 1 && sidesChangeAfterSet(match.rules.format, set - 1);
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
                  set > 1
                    ? `${sidesChanged ? "Campi invertiti" : "Stessi campi del set prima (si cambia ogni 2 set)"}, formazioni di partenza ripristinate.`
                    : null,
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
                    "inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 py-2 text-[15px] font-bold transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : toss
                        ? "border-amber-600/60 bg-white text-foreground hover:bg-amber-100"
                        : "border-border-strong/70 text-foreground/80 hover:bg-muted",
                  )}
                >
                  <TeamDot match={match} teamKey={key} />
                  {displayLabel(match[teamKeyProp(key)], key)}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            onClick={onToggleLineups}
            disabled={editingLineups && lineupsBlocked}
            title={editingLineups && lineupsBlocked ? "Prima correggi i numeri in rosso" : undefined}
            data-livescore-check-lineups
            className="border-2"
          >
            <Pencil className="h-4 w-4" />
            {editingLineups ? "Fatto" : "Controlla formazioni"}
          </Button>
          {savedLineup && (
            <Button variant="outline" onClick={savedLineup.onUse} data-livescore-use-saved className="border-2">
              {savedLineup.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
