"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { SegmentedButtons } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import {
  currentSet,
  liberoInPlay,
  substitutionLimit,
  substitutionProblem,
  teamKeyProp,
  type TeamKey,
} from "@/lib/liveScore";
import type { RegistryChoices } from "@/lib/jersey";
import type { CourtPosition, LiveScoreState } from "@/lib/types";
import { shortName } from "@/components/matches/VolleyCourt";

/**
 * Sostituzione durante il gioco: si sceglie la squadra, chi esce (tra chi è in
 * campo) e chi entra — in Allenamento un'atleta del registro che non è già in
 * campo, o un nome scritto a mano; in Partita il numero di maglia. Resta
 * dentro il riquadro del tabellone (non in un portale sul body), così si vede
 * anche a schermo intero.
 */
export function SubstitutionDialog({
  match,
  initialTeam,
  initialPosition,
  athleteNames,
  numberChoices,
  teamLabel,
  onConfirm,
  onClose,
}: {
  match: LiveScoreState;
  initialTeam: TeamKey;
  initialPosition: CourtPosition | null;
  athleteNames: string[];
  /** In Partita, i numeri dell'anagrafica da proporre come panchina della nostra squadra. */
  numberChoices?: RegistryChoices;
  teamLabel: (key: TeamKey) => string;
  onConfirm: (team: TeamKey, position: CourtPosition, incoming: string) => void;
  onClose: () => void;
}) {
  const [teamKey, setTeamKey] = useState<TeamKey>(initialTeam);
  const [position, setPosition] = useState<CourtPosition | null>(initialPosition);
  const [incoming, setIncoming] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const team = match[teamKeyProp(teamKey)];
  const numeric = match.mode === "match";
  const set = currentSet(match);
  const limit = substitutionLimit(match.playersPerSide);
  const setSubstitutions = match.substitutions.filter((s) => s.team === teamKey && s.set === set);
  const showLibero = liberoInPlay(match, team);

  // In Allenamento le due squadre pescano dallo stesso registro: in panchina
  // c'è chi non è in campo in nessuna delle due (né fa la libero).
  const busy = new Set(
    [...match.teamA.positions, ...match.teamB.positions, match.teamA.liberoName, match.teamB.liberoName]
      .map((n) => n.trim())
      .filter(Boolean),
  );
  // In Partita, per la nostra squadra, la panchina arriva dai numeri dell'anagrafica (chi non è già in campo).
  const registryBench =
    numeric && teamKey === "A" && numberChoices
      ? [...numberChoices.calledUp, ...numberChoices.others].filter((r) => !busy.has(r.number))
      : [];
  const bench = numeric ? registryBench.map((r) => ({ value: r.number, label: `${r.number} · ${shortName(r.name)}` })) : athleteNames.filter((name) => !busy.has(name)).map((name) => ({ value: name, label: name }));

  function chooseTeam(key: TeamKey) {
    setTeamKey(key);
    setPosition(null);
    setIncoming("");
    setError(null);
  }

  function confirm() {
    if (position === null) {
      setError("Scegli chi esce.");
      return;
    }
    const problem = substitutionProblem(match, teamKey, position, incoming);
    if (problem) {
      setError(problem);
      return;
    }
    onConfirm(teamKey, position, incoming.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-sea-950/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="substitution-title"
        data-livescore-substitution
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="substitution-title" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Sostituzione
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {set}° set · cambi di {teamLabel(teamKey)}: <b className="text-foreground">{team.substitutionsUsed}</b>
              {limit !== null && ` su ${limit}`}
            </p>
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4">
          <SegmentedButtons
            ariaLabel="Squadra"
            value={teamKey}
            onChange={chooseTeam}
            items={(["A", "B"] as const).map((key) => ({ value: key, label: teamLabel(key) }))}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Esce</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {team.positions.map((name, i) => {
              const pos = (i + 1) as CourtPosition;
              const replacedByLibero = showLibero && team.liberoActiveFor !== null && name.trim() === team.liberoActiveFor;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => {
                    setPosition(pos);
                    setError(null);
                  }}
                  aria-pressed={position === pos}
                  className={cn(
                    "flex min-w-0 flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors",
                    position === pos
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle text-foreground hover:bg-muted",
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pos. {pos}</span>
                  <span className="w-full truncate text-sm font-bold">{name.trim() || "—"}</span>
                  {replacedByLibero && <span className="text-[11px] text-muted-foreground">ora c&apos;è la libero</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="substitution-in">Entra</Label>
          {bench.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {bench.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => {
                    setIncoming(choice.value);
                    setError(null);
                  }}
                  aria-pressed={incoming === choice.value}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
                    incoming === choice.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle text-foreground/80 hover:bg-muted",
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}
          <Input
            id="substitution-in"
            value={incoming}
            onChange={(e) => {
              setIncoming(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
            }}
            inputMode={numeric ? "numeric" : undefined}
            placeholder={
              numeric
                ? bench.length > 0
                  ? "Oppure scrivi un altro numero"
                  : "Numero di maglia"
                : bench.length > 0
                  ? "Oppure scrivi un altro nome"
                  : "Nome di chi entra"
            }
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        {setSubstitutions.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface-muted px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cambi in questo set</p>
            <ul className="mt-1 space-y-0.5 text-sm text-foreground">
              {setSubstitutions.map((s, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">Pos. {s.position}:</span> esce <b>{s.out}</b>, entra <b>{s.in}</b>
                </li>
              ))}
            </ul>
          </div>
        )}

        {limit !== null && team.substitutionsUsed >= limit && (
          <p className="mt-3 text-[13px] text-muted-foreground">
            Sono già stati fatti {limit} cambi in questo set: il regolamento non ne prevede altri.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={confirm}>
            <ArrowLeftRight className="h-4 w-4" />
            Conferma cambio
          </Button>
        </div>
      </div>
    </div>
  );
}
