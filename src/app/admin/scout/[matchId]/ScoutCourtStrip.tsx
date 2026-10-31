"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Pencil, Plus, RotateCcw, RotateCw, UserRoundCheck, Volleyball, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { cleanNumber, opponentPlayer, type ScoutAction } from "@/lib/scout/actions";
import { benchOf, COURT_ROWS, jerseyLabel, reentryOfPlayer, SUBSTITUTIONS_PER_SET, substitutionsUsed, substitutionWarningFor } from "@/lib/scout/court";
import { shiftCourt, type ScoutCourt, type ScoutView } from "@/lib/scout/derive";
import { playerLabel, shortName, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import type { ScoutData, ScoutPlayer, ScoutSide } from "@/lib/scout/types";
import { CourtNet, CourtThreeMeterLine } from "./ScoutCourtPicker";

/** Come si legge una giocatrice sul campo: il numero di maglia (per noi, in mancanza, l'iniziale). */
function chipText(player: ScoutPlayer | undefined, side: ScoutSide): string {
  return player ? jerseyLabel(player, side) : "?";
}

/** Chi è, a parole: «7 Giulia B.» per noi, «n. 7» per l'avversaria. */
function whoText(player: ScoutPlayer | undefined, side: ScoutSide, roster: ScoutPlayer[]): string {
  if (!player) return "?";
  return side === "us" ? `${chipText(player, side)} ${shortName(player, roster)}` : `n. ${chipText(player, side)}`;
}

/**
 * Una metà campo in piccolo: chi gioca in ogni posizione (numero e, per noi, il nome), con la libero in scuro
 * al posto di chi sostituisce e un pallone verde su chi batte.
 */
function MiniCourt({
  side,
  court,
  roster,
  serving,
  large = false,
  preview = false,
}: {
  side: ScoutSide;
  court: ScoutCourt;
  roster: ScoutPlayer[];
  serving: boolean;
  /** Celle più alte e numeri più grandi (schermo intero su schermo largo, dove c'è posto). */
  large?: boolean;
  /** Anteprima dentro una finestra (la correzione della rotazione): non si confonde con il campo vero in pagina. */
  preview?: boolean;
}) {
  return (
    <div
      className="grid gap-1"
      role="group"
      aria-label={side === "us" ? "Nostra squadra in campo" : "Avversaria in campo"}
      data-scout-court={preview ? undefined : side}
      data-scout-rotate-preview={preview ? side : undefined}
    >
      {COURT_ROWS.map((row, r) => (
        <div key={r} className="grid grid-cols-3 gap-1">
          {row.map((position) => {
            const id = court.onCourt[position - 1];
            const player = id ? roster.find((p) => p.id === id) : undefined;
            const isLibero = Boolean(id) && id === court.libero;
            const isServer = serving && position === 1;
            return (
              <div
                key={position}
                data-scout-court-position={preview ? undefined : position}
                data-scout-court-player={preview ? undefined : id || undefined}
                data-scout-preview-position={preview ? position : undefined}
                data-scout-preview-player={preview ? id || undefined : undefined}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 text-center",
                  large ? "h-[clamp(3.25rem,8vh,4.75rem)]" : "h-[3.25rem] sm:h-14",
                  id ? (isLibero ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground") : "border-dashed border-border-strong bg-surface-muted/50 text-muted-foreground/60",
                  isServer && "ring-2 ring-green-500 ring-offset-1 ring-offset-card",
                )}
                title={id ? `${playerLabel({ us: side === "us" ? roster : [], opp: side === "opp" ? roster : [] }, side, id)} · posizione ${position}${isLibero ? " (libero)" : ""}` : `Posizione ${position}: vuota`}
              >
                <span className="absolute left-1 top-0.5 text-[9px] font-bold leading-none text-muted-foreground/70">{position}</span>
                <span className={cn("tabular font-display font-extrabold leading-none", large ? "text-[clamp(17px,3vh,26px)]" : "text-[17px]")}>{id ? chipText(player, side) : "–"}</span>
                {/* Il nome, per chi non conosce ancora i numeri a memoria (solo per noi: dell'avversaria si hanno solo i numeri). */}
                {side === "us" && player && (
                  <span className={cn("mt-0.5 w-full truncate font-semibold leading-none", large ? "text-[clamp(10px,1.7vh,13px)]" : "text-[10px]", isLibero ? "opacity-80" : "text-muted-foreground")}>
                    {shortName(player, roster)}
                  </span>
                )}
                {isLibero && <span className="absolute right-1 top-0.5 text-[8px] font-bold uppercase leading-none tracking-wide opacity-80">libero</span>}
                {isServer && (
                  <span className="absolute -right-1 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-green-500 text-white shadow-sm" aria-label="Batte">
                    <Volleyball className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Un giocatore da scegliere (numero e nome), per «Chi entra» e per la nuova libero. */
function BenchChip({
  player,
  side,
  roster,
  selected,
  onClick,
  testId,
  extra,
  tone = "default",
}: {
  player: ScoutPlayer;
  side: ScoutSide;
  roster: ScoutPlayer[];
  selected: boolean;
  onClick: () => void;
  testId: Record<`data-${string}`, string | undefined>;
  /** Sotto il nome: per esempio «rientra». */
  extra?: string;
  tone?: "default" | "reentry";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      {...testId}
      className={cn(
        "flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-colors",
        selected
          ? "border-primary bg-primary-soft ring-2 ring-primary/30"
          : tone === "reentry"
            ? "border-emerald-600/50 bg-emerald-50 hover:bg-emerald-100"
            : "border-border-subtle bg-surface hover:bg-muted",
      )}
    >
      <span className="tabular font-display text-xl font-extrabold leading-none text-foreground">{chipText(player, side)}</span>
      {extra ? (
        <span className="mt-0.5 w-full truncate text-[10px] font-bold uppercase tracking-wide text-emerald-800">{extra}</span>
      ) : (
        side === "us" && <span className="mt-0.5 w-full truncate text-[11px] font-semibold text-muted-foreground">{shortName(player, roster)}</span>
      )}
    </button>
  );
}

/**
 * Cambio di libero: non è un cambio ufficiale (non conta tra quelli del set), quindi non passa dalla sostituzione.
 * Si sceglie chi diventa la libero tra chi è in panchina; centrali sostituite e posizioni restano come sono.
 */
function LiberoPanel({
  court,
  roster,
  dispatch,
  onBack,
  onClose,
}: {
  court: ScoutCourt;
  roster: ScoutPlayer[];
  dispatch: (action: ScoutAction) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const bench = benchOf(roster, court);
  const [chosen, setChosen] = useState<string | null>(null);
  const current = roster.find((p) => p.id === court.libero);

  function confirm() {
    const player = roster.find((p) => p.id === chosen);
    if (!player) return;
    // La nuova libero si segna come tale nella rosa (così non attacca né batte); poi la formazione, con tutto il resto com'è.
    if (!player.libero) dispatch({ type: "updatePlayer", side: "us", id: player.id, patch: { libero: true } });
    dispatch({
      type: "lineup",
      side: "us",
      input: {
        positions: court.positions.map((id) => id || null),
        libero: player.id,
        hosts: [court.hosts[0] || null, court.hosts[1] || null],
      },
      at: Date.now(),
      id: newId(),
    });
    onClose();
  }

  return (
    <div data-scout-libero-panel>
      <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
        Il cambio della libero non è un cambio ufficiale: non conta tra gli {SUBSTITUTIONS_PER_SET} del set. Chi esce va in panchina, la nuova libero entra e
        esce da sola come la precedente.
      </p>
      <div className="mt-3 rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm">
        <span className="text-muted-foreground">Adesso la libero è </span>
        <b className="text-foreground">{current ? whoText(current, "us", roster) : "—"}</b>
      </div>
      <p className="mb-1.5 mt-4 text-[13px] font-semibold text-foreground/80">Chi diventa la libero</p>
      {bench.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label="Nuova libero">
          {bench.map((player) => (
            <BenchChip
              key={player.id}
              player={player}
              side="us"
              roster={roster}
              selected={chosen === player.id}
              onClick={() => setChosen(player.id)}
              testId={{ "data-scout-libero-in": player.id }}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted-foreground">Non c&apos;è nessuna giocatrice in panchina.</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>
          Indietro
        </Button>
        <Button onClick={confirm} disabled={!chosen} data-scout-libero-confirm>
          <ArrowLeftRight className="h-4 w-4" />
          Cambia la libero
        </Button>
      </div>
    </div>
  );
}

/**
 * Il cambio: si sceglie chi esce (toccandola dove sta sul campo, con numero e nome) e chi entra (dalla
 * panchina; per l'avversaria si può scrivere un numero nuovo). Se il cambio non
 * rispetta le regole compare un avvertimento, ma si può confermare lo stesso.
 * Una titolare uscita può rientrare (una volta sola) solo al posto di chi l'ha
 * sostituita, dovunque quella sia adesso: scegliendola, «chi esce» si sceglie da solo.
 * Per la nostra squadra c'è anche il cambio della libero, che non è un cambio ufficiale.
 * Né lo è far rientrare chi la libero stava sostituendo (la libero esce e resta fuori) o rimettere la libero.
 */
function SubstitutionSheet({
  side,
  data,
  view,
  serving,
  dispatch,
  onClose,
}: {
  side: ScoutSide;
  data: ScoutData;
  view: ScoutView;
  /** La squadra batte adesso: il pallone verde sta su chi è in posizione 1. */
  serving: boolean;
  dispatch: (action: ScoutAction) => void;
  onClose: () => void;
}) {
  const court = view.court[side] as ScoutCourt;
  const roster = data.roster[side];
  const bench = benchOf(roster, court);
  const [mode, setMode] = useState<"sub" | "libero">("sub");
  const [position, setPosition] = useState<1 | 2 | 3 | 4 | 5 | 6 | null>(null);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const used = substitutionsUsed(view, side);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const warning = position !== null && incoming ? substitutionWarningFor(data, view, side, position, incoming) : null;
  const reentry = incoming ? reentryOfPlayer(view, side, incoming) : null;
  /** Chi entra: se è una titolare che rientra, «chi esce» è la sua sostituta, dove sta adesso. */
  function chooseIncoming(id: string) {
    setIncoming(id);
    const back = reentryOfPlayer(view, side, id);
    if (back) setPosition(back.position);
  }
  const sideSubs = view.current?.subs.filter((sub) => sub.side === side) ?? [];

  function addNumber() {
    const number = cleanNumber(typed);
    if (!number) return;
    const added = opponentPlayer(number);
    if (court.positions.includes(added.id)) return;
    dispatch({ type: "addPlayer", side: "opp", player: added });
    setIncoming(added.id);
    setTyped("");
  }

  function confirm() {
    if (position === null || !incoming) return;
    dispatch({ type: "sub", side, position, player: incoming, at: Date.now(), id: newId() });
    onClose();
  }

  const sideName = side === "us" ? "nostra squadra" : "avversaria";
  // Un'avversaria appena scritta non è ancora in panchina finché la rosa non si aggiorna: la si mostra comunque.
  const shownBench = incoming && !bench.some((p) => p.id === incoming) && roster.some((p) => p.id === incoming) ? sortPlayers([...bench, ...roster.filter((p) => p.id === incoming)]) : bench;
  const outPlayer = position !== null ? roster.find((p) => p.id === court.positions[position - 1]) : undefined;
  const inPlayer = incoming ? roster.find((p) => p.id === incoming) : undefined;
  const canChangeLibero = side === "us" && Boolean(court.libero);
  /** Chi la libero sta sostituendo adesso: l'allenatore può farla rientrare (e la libero esce). */
  const liberoHost = court.libero && !court.liberoOut && court.liberoFor ? roster.find((p) => p.id === court.liberoFor) : undefined;

  function liberoOut(out: boolean) {
    dispatch({ type: "libero", side, out, at: Date.now(), id: newId() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "libero" ? "Cambio della libero" : `Cambio: ${sideName}`}
        data-scout-sheet="sub"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-foreground">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              {mode === "libero" ? "Cambio della libero" : `Cambio · ${side === "us" ? "noi" : "loro"}`}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {view.current?.n}° set · cambi fatti: <b className="text-foreground">{used}</b> su {SUBSTITUTIONS_PER_SET}
            </p>
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {mode === "libero" ? (
          <LiberoPanel court={court} roster={roster} dispatch={dispatch} onBack={() => setMode("sub")} onClose={onClose} />
        ) : (
          <>
            <div className="mt-4">
              <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">
                Chi esce <span className="font-normal text-muted-foreground">· tocca dove sta in campo</span>
              </p>
              {/* Il campo come lo si vede dalla propria metà (rete in alto, davanti 4-3-2, dietro 5-6-1): lo stesso disegno di «In campo». */}
              <div
                role="group"
                aria-label="Chi esce"
                className={cn("rounded-2xl border p-2.5", side === "us" ? "border-primary/25 bg-primary-soft/60" : "border-sand-400/50 bg-accent/50")}
              >
                <CourtNet />
                {COURT_ROWS.map((row, r) => (
                  <div key={r}>
                    {r === 1 && <CourtThreeMeterLine />}
                    <div className="grid grid-cols-3 gap-2">
                      {row.map((pos) => {
                        const place = pos as 1 | 2 | 3 | 4 | 5 | 6;
                        const id = court.positions[place - 1];
                        const player = id ? roster.find((p) => p.id === id) : undefined;
                        const replacedByLibero = Boolean(id) && court.liberoFor === id;
                        const enteredFor = id ? sideSubs.find((sub) => sub.in === id) : undefined;
                        const isServer = serving && place === 1;
                        return (
                          <button
                            key={pos}
                            type="button"
                            disabled={!id}
                            aria-pressed={position === place}
                            onClick={() => setPosition(place)}
                            data-scout-sub-out={pos}
                            className={cn(
                              "relative flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center transition-colors disabled:opacity-40",
                              position === place ? "border-primary bg-primary-soft ring-2 ring-primary/30" : "border-border bg-surface hover:bg-muted",
                              isServer && position !== place && "ring-2 ring-green-500 ring-offset-1 ring-offset-surface",
                            )}
                          >
                            <span className="absolute left-1.5 top-1 text-[10px] font-bold leading-none text-muted-foreground/80">{pos}</span>
                            <span className="tabular font-display text-2xl font-extrabold leading-none text-foreground">{id ? chipText(player, side) : "–"}</span>
                            {side === "us" && player && <span className="mt-0.5 w-full truncate text-[12px] font-semibold leading-tight text-muted-foreground">{shortName(player, roster)}</span>}
                            {replacedByLibero && <span className="text-[10px] leading-tight text-muted-foreground">ora c&apos;è la libero</span>}
                            {enteredFor && <span className="text-[10px] leading-tight text-muted-foreground">entrata per {chipText(roster.find((p) => p.id === enteredFor.out), side)}</span>}
                            {isServer && (
                              <span className="absolute -right-1 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-green-500 text-white shadow-sm" aria-label="Batte">
                                <Volleyball className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Chi entra</p>
              {shownBench.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5" role="group" aria-label="Chi entra">
                  {shownBench.map((player) => {
                    const back = reentryOfPlayer(view, side, player.id);
                    return (
                      <BenchChip
                        key={player.id}
                        player={player}
                        side={side}
                        roster={roster}
                        selected={incoming === player.id}
                        onClick={() => chooseIncoming(player.id)}
                        extra={back ? "rientra" : undefined}
                        tone={back ? "reentry" : "default"}
                        testId={{ "data-scout-sub-in": player.id, "data-scout-sub-reentry-chip": back ? "" : undefined }}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
                  {side === "us" ? "Non c'è nessuna giocatrice in panchina: aggiungila da «Squadre e regole»." : "Scrivi qui sotto il numero di chi entra."}
                </p>
              )}
              {side === "opp" && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNumber();
                      }
                    }}
                    inputMode="numeric"
                    placeholder="Altro numero di maglia"
                    aria-label="Numero di maglia di chi entra"
                    data-scout-sub-number
                    className="min-w-0"
                  />
                  <Button variant="outline" onClick={addNumber} disabled={!cleanNumber(typed)}>
                    <Plus className="h-4 w-4" />
                    Aggiungi
                  </Button>
                </div>
              )}
            </div>

            {reentry && position === reentry.position && (
              <p data-scout-sub-reentry className="mt-3 text-[13px] font-medium text-emerald-800">
                Rientra al posto di {chipText(roster.find((p) => p.id === reentry.replacedBy), side)} (posizione {reentry.position}): una titolare può rientrare una volta sola, e solo per chi l&apos;ha sostituita.
              </p>
            )}

            {warning && (
              <p data-scout-sub-warning className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-950 ring-1 ring-amber-500/40">
                Attenzione: {warning} Puoi confermare lo stesso (per esempio per un infortunio).
              </p>
            )}

            {/* Il cambio a parole, prima di confermarlo: chi esce, da che posizione, e chi entra. */}
            {position !== null && incoming && (
              <p data-scout-sub-summary className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-[13px] font-semibold text-foreground">
                Esce <b>{whoText(outPlayer, side, roster)}</b> (posizione {position}) · entra <b>{whoText(inPlayer, side, roster)}</b>
              </p>
            )}

            {liberoHost && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2.5" data-scout-libero-out-box>
                <p className="text-[13px] leading-snug text-muted-foreground">
                  <b className="text-foreground">Rientra {whoText(liberoHost, side, roster)} al posto della libero?</b> Non è un cambio: la libero resta fuori finché
                  non la fai rientrare.
                </p>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => liberoOut(true)} data-scout-libero-out>
                  <UserRoundCheck className="h-4 w-4" />
                  Rientra {chipText(liberoHost, side)}
                </Button>
              </div>
            )}

            {court.libero && court.liberoOut && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-500/40" data-scout-libero-back-box>
                <p className="text-[13px] leading-snug text-amber-950">
                  <b>La libero è fuori.</b> Rientrando torna al posto della centrale in seconda linea, come sempre.
                </p>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => liberoOut(false)} data-scout-libero-back>
                  <UserRoundCheck className="h-4 w-4" />
                  Rientra la libero
                </Button>
              </div>
            )}

            {canChangeLibero && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2.5">
                <p className="text-[13px] leading-snug text-muted-foreground">
                  <b className="text-foreground">Cambi la libero?</b> Non è un cambio ufficiale: si fa da qui.
                </p>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setMode("libero")} data-scout-libero-open>
                  Cambia la libero
                </Button>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Annulla
              </Button>
              <Button onClick={confirm} disabled={position === null || !incoming} data-scout-sub-confirm>
                <ArrowLeftRight className="h-4 w-4" />
                Conferma cambio
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Correzione della rotazione, per quando se ne è saltata una (o ne è stata segnata una di troppo): si sceglie di quante
 * posizioni girare, avanti o indietro, si vede come starà la squadra in campo e si conferma. Cambia solo chi sta in ogni
 * posizione: punteggio, battuta, cambi e time-out restano come sono. L'anteprima usa la stessa funzione che applica la
 * correzione (shiftCourt), quindi il campo che si vede qui è quello che si ottiene.
 */
function RotationSheet({
  side,
  data,
  view,
  serving,
  dispatch,
  onClose,
}: {
  side: ScoutSide;
  data: ScoutData;
  view: ScoutView;
  /** La squadra batte adesso: chi sta in posizione 1 batte, la libero non lo sostituisce. */
  serving: boolean;
  dispatch: (action: ScoutAction) => void;
  onClose: () => void;
}) {
  const court = view.court[side] as ScoutCourt;
  const roster = data.roster[side];
  // Da −5 a 5: indietro (negativo) o avanti (positivo), 0 = nessuna correzione.
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const after = steps === 0 ? court : shiftCourt(court, steps, serving);
  const sideName = side === "us" ? "nostra squadra" : "avversaria";
  const who = (id: string | undefined) => whoText(id ? roster.find((p) => p.id === id) : undefined, side, roster);
  const summary = steps === 0 ? "Nessuna correzione" : steps > 0 ? `Avanti di ${steps}` : `Indietro di ${-steps}`;

  function confirm() {
    if (steps === 0) return;
    dispatch({ type: "rotate", side, steps, at: Date.now(), id: newId() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Rotazione: ${sideName}`}
        data-scout-sheet="rotate"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold leading-tight text-foreground">
              <RotateCw className="h-5 w-5 text-primary" />
              Rotazione · {side === "us" ? "noi" : "loro"}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {view.current?.n}° set · adesso la <b className="text-foreground">{court.rotation}ª</b> rotazione
            </p>
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          Se una rotazione è saltata, o ne è stata segnata una di troppo, gira la squadra avanti o indietro. Cambia solo chi sta in ogni posizione:{" "}
          <b className="text-foreground">punteggio, battuta, cambi e time-out restano come sono.</b>
        </p>

        <div
          className={cn("mt-3 rounded-2xl border p-2.5", side === "us" ? "border-primary/25 bg-primary-soft/60" : "border-sand-400/50 bg-accent/50")}
          data-scout-rotate-court
        >
          <CourtNet />
          <MiniCourt side={side} court={after} roster={roster} serving={serving} preview />
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Button variant="outline" onClick={() => setSteps((value) => Math.max(-5, value - 1))} disabled={steps <= -5} data-scout-rotate-back>
            <RotateCcw className="h-4 w-4" />
            Indietro
          </Button>
          <span className="min-w-[8.5rem] text-center text-sm font-bold text-foreground" aria-live="polite" data-scout-rotate-steps={steps}>
            {summary}
          </span>
          <Button variant="outline" onClick={() => setSteps((value) => Math.min(5, value + 1))} disabled={steps >= 5} data-scout-rotate-forward>
            Avanti
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-[13px] leading-snug text-foreground" data-scout-rotate-after={after.rotation}>
          Dopo: <b>{after.rotation}ª</b> rotazione ·{" "}
          {serving ? (
            <>
              batte <b>{who(after.positions[0])}</b>
            </>
          ) : (
            <>
              quando riconquista la battuta batte <b>{who(after.positions[1])}</b>
            </>
          )}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={confirm} disabled={steps === 0} data-scout-rotate-confirm>
            <RotateCw className="h-4 w-4" />
            Applica
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chi è in campo, sopra i pulsanti dei punti: le due squadre (quelle di cui si
 * segue la formazione) con le rotazioni, chi batte, la libero e i cambi del set.
 * Si ruota da soli quando una squadra conquista la battuta; se una rotazione è
 * saltata, «Rotazione» la corregge avanti o indietro senza toccare il punteggio.
 */
export function ScoutCourtStrip({
  data,
  view,
  locked,
  dispatch,
  onEditLineup,
  large = false,
}: {
  data: ScoutData;
  view: ScoutView;
  locked: boolean;
  dispatch: (action: ScoutAction) => void;
  onEditLineup: () => void;
  /** Schermo intero su schermo largo: il campo è più grande, perché in colonna c'è posto. */
  large?: boolean;
}) {
  const [subSide, setSubSide] = useState<ScoutSide | null>(null);
  const [rotateSide, setRotateSide] = useState<ScoutSide | null>(null);
  const sides = (["us", "opp"] as const).filter((side) => view.court[side]);
  if (sides.length === 0) return null;
  const server = view.current ? (view.current.rallies.length > 0 ? view.current.rallies[view.current.rallies.length - 1].winner : view.current.firstServer) : null;

  return (
    <section
      aria-label="In campo"
      data-scout-court-strip
      data-tour="scout-court-strip"
      className={cn("shrink-0 space-y-2.5 rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4", large && "space-y-3")}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-extrabold leading-none tracking-[-0.01em] text-foreground">In campo</h2>
        <Button variant="outline" size="xs" onClick={onEditLineup} data-scout-edit-lineup>
          <Pencil className="h-3.5 w-3.5" />
          Formazione
        </Button>
      </header>
      <div className={cn("grid gap-3", sides.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:max-w-sm")}>
        {sides.map((side) => {
          const court = view.court[side] as ScoutCourt;
          const used = substitutionsUsed(view, side);
          return (
            <div key={side} className="min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <p className={cn("text-[13px] font-bold", side === "us" ? "text-primary" : "text-accent-foreground")}>
                  {side === "us" ? "Noi" : "Loro"}
                  <span className="ml-1.5 font-semibold text-muted-foreground" title="Rotazione: 1ª è la formazione di partenza, poi si ruota quando si conquista la battuta">
                    {court.rotation}ª rot.
                  </span>
                </p>
                <span className="flex items-center gap-1.5">
                  {server === side && <span className="text-[10px] font-bold uppercase tracking-wide text-green-700">batte</span>}
                  {/* Rotazione sbagliata? Si corregge da qui, accanto al numero: sul telefono solo l'icona, per non allargare la colonna. */}
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={locked}
                    onClick={() => setRotateSide(side)}
                    title="Correggi la rotazione: avanti o indietro, senza cambiare il punteggio"
                    aria-label={`Correggi la rotazione: ${side === "us" ? "nostra squadra" : "avversaria"}`}
                    data-scout-rotate-open={side}
                  >
                    <RotateCw className="h-3 w-3" />
                    <span className="hidden sm:inline">Rotazione</span>
                  </Button>
                </span>
              </div>
              <MiniCourt side={side} court={court} roster={data.roster[side]} serving={server === side} large={large} />
              {/* La libero tolta dall'allenatore resta fuori finché non la si rimette: un promemoria, con il tasto per farla rientrare. */}
              {court.libero && court.liberoOut && (
                <div className="flex items-center justify-between gap-1 rounded-lg bg-amber-50 py-1 pl-2 pr-1 ring-1 ring-amber-500/40" data-scout-libero-out-note={side}>
                  <span className="truncate text-[11px] font-semibold text-amber-950">Libero fuori</span>
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={locked}
                    onClick={() => dispatch({ type: "libero", side, out: false, at: Date.now(), id: newId() })}
                    title="La libero rientra al posto della centrale in seconda linea"
                    data-scout-libero-back-strip={side}
                  >
                    Rientra
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-medium text-muted-foreground" title={`Cambi fatti nel set (${SUBSTITUTIONS_PER_SET} al massimo)`}>
                  Cambi {used}/{SUBSTITUTIONS_PER_SET}
                </span>
                <Button variant="outline" size="xs" disabled={locked} onClick={() => setSubSide(side)} data-scout-sub-open={side}>
                  <ArrowLeftRight className="h-3 w-3" />
                  Cambio
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {subSide && view.court[subSide] && (
        <SubstitutionSheet side={subSide} data={data} view={view} serving={server === subSide} dispatch={dispatch} onClose={() => setSubSide(null)} />
      )}
      {rotateSide && view.court[rotateSide] && (
        <RotationSheet side={rotateSide} data={data} view={view} serving={server === rotateSide} dispatch={dispatch} onClose={() => setRotateSide(null)} />
      )}
    </section>
  );
}
