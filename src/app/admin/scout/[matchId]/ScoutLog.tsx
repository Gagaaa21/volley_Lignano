"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { SegmentedButtons } from "@/components/ui/Segmented";
import type { ScoutAction } from "@/lib/scout/actions";
import type { ScoutRally, ScoutView } from "@/lib/scout/derive";
import { playerLabel, rallyText, sortPlayers } from "@/lib/scout/describe";
import { ERROR_HOWS, HOW_META, POINT_HOWS, rallyWinner } from "@/lib/scout/rules";
import { otherSide, type ScoutHow, type ScoutRoster, type ScoutSide } from "@/lib/scout/types";

/**
 * Il registro degli scambi, dal più recente: serve a controllare che sia
 * tutto giusto e a correggere uno scambio (chi, come, a chi) o toglierlo
 * senza dover annullare tutto quello che è venuto dopo. Punteggi e battute si
 * ricalcolano da soli.
 */

function RallyEditDialog({
  rally,
  roster,
  dispatch,
  onClose,
}: {
  rally: ScoutRally;
  roster: ScoutRoster;
  dispatch: (action: ScoutAction) => void;
  onClose: () => void;
}) {
  const [actor, setActor] = useState<ScoutSide>(rally.actor);
  const [how, setHow] = useState<ScoutHow>(rally.how);
  const [player, setPlayer] = useState(rally.player ?? "");
  const [victim, setVictim] = useState(rally.victim ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const winner = rallyWinner(how, actor);
  const attackers = sortPlayers(roster[otherSide(actor)]);

  function save() {
    dispatch({
      type: "update",
      id: rally.id,
      patch: { actor, how, player: player || null, victim: how === "block" ? victim || null : null },
    });
    onClose();
  }

  function remove() {
    if (!window.confirm("Togliere questo scambio dal registro? Il punteggio si ricalcola.")) return;
    dispatch({ type: "remove", id: rally.id });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-sea-950/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Correggi lo scambio ${rally.n}`}
        data-scout-sheet="edit"
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border-subtle bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(9,26,38,0.55)] sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold leading-tight text-foreground">Correggi lo scambio {rally.n}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {rally.set}° set · dopo questo punto era {rally.score.us}–{rally.score.opp}
            </p>
          </div>
          <Button variant="quiet" size="icon-sm" onClick={onClose} aria-label="Chiudi">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Chi ha agito</p>
            <SegmentedButtons
              ariaLabel="Chi ha agito"
              value={actor}
              onChange={(next) => {
                setActor(next);
                setPlayer("");
                setVictim("");
              }}
              items={[
                { value: "us", label: "Noi" },
                { value: "opp", label: "Loro" },
              ]}
            />
          </div>

          <div>
            <Label htmlFor="scout-edit-how">Come è finito lo scambio</Label>
            <Select id="scout-edit-how" value={how} onChange={(e) => setHow(e.target.value as ScoutHow)}>
              <optgroup label="Punto di chi agisce">
                {POINT_HOWS.map((value) => (
                  <option key={value} value={value}>
                    {HOW_META[value].label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Errore o fallo di chi agisce (punto all'altra squadra)">
                {ERROR_HOWS.map((value) => (
                  <option key={value} value={value}>
                    {HOW_META[value].label}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>

          <div>
            <Label htmlFor="scout-edit-player">Giocatrice</Label>
            <Select id="scout-edit-player" value={player} onChange={(e) => setPlayer(e.target.value)}>
              <option value="">Non indicata</option>
              {sortPlayers(roster[actor]).map((p) => (
                <option key={p.id} value={p.id}>
                  {playerLabel(roster, actor, p.id)}
                </option>
              ))}
            </Select>
          </div>

          {how === "block" && (
            <div>
              <Label htmlFor="scout-edit-victim">Chi attaccava</Label>
              <Select id="scout-edit-victim" value={victim} onChange={(e) => setVictim(e.target.value)}>
                <option value="">Non indicata</option>
                {attackers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {playerLabel(roster, otherSide(actor), p.id)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
            Il punto va a <b>{winner === "us" ? "noi" : "loro"}</b>.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Button variant="danger-ghost" onClick={remove}>
            <Trash2 className="h-4 w-4" />
            Togli
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annulla
            </Button>
            <Button onClick={save} data-scout-edit-save>
              Salva
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RallyRow({ rally, roster, onEdit }: { rally: ScoutRally; roster: ScoutRoster; onEdit: () => void }) {
  const text = rallyText(rally, roster);
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5" data-scout-rally={rally.n} data-scout-winner={text.winner}>
      <span className="tabular w-[3.25rem] shrink-0 text-sm font-bold text-foreground">
        {rally.score.us}–{rally.score.opp}
      </span>
      <Badge tone={text.winner === "us" ? "primary" : "gold"} className="shrink-0">
        {text.winner === "us" ? "Noi" : "Loro"}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-foreground">{text.label}</p>
        <p className="text-xs leading-snug text-muted-foreground">
          {HOW_META[rally.how].scores ? "" : rally.actor === "us" ? "Errore nostro · " : "Errore loro · "}
          {text.who}
          {text.victim ? ` · su ${text.victim}` : ""}
        </p>
      </div>
      <Button variant="quiet" size="icon-sm" onClick={onEdit} aria-label={`Correggi lo scambio ${rally.n}`}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

export function ScoutLog({
  view,
  roster,
  dispatch,
}: {
  view: ScoutView;
  roster: ScoutRoster;
  dispatch: (action: ScoutAction) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? view.rallies.find((r) => r.id === editingId) : undefined;
  const sets = view.sets.filter((set) => set.rallies.length > 0).reverse();

  if (sets.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-5 py-8 text-center text-sm text-muted-foreground">
        Qui compariranno gli scambi, dall&apos;ultimo al primo. Segna il primo punto con i pulsanti qui sopra.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-scout-log>
      {sets.map((set, i) => (
        <details
          key={set.n}
          // Il set più recente è aperto, quelli chiusi restano raccolti.
          open={i === 0}
          className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
            <span>
              {set.n}° set <span className="ml-1.5 tabular text-muted-foreground">{set.score.us}–{set.score.opp}</span>
            </span>
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {set.closed ? (
                set.winner && <Badge tone={set.winner === "us" ? "success" : "danger"}>{set.winner === "us" ? "Vinto" : "Perso"}</Badge>
              ) : (
                <Badge tone="warning">In corso</Badge>
              )}
              {set.rallies.length} scambi
            </span>
          </summary>
          <ol className="divide-y divide-border border-t border-border">
            {[...set.rallies].reverse().map((rally) => (
              <RallyRow key={rally.id} rally={rally} roster={roster} onEdit={() => setEditingId(rally.id)} />
            ))}
          </ol>
        </details>
      ))}

      {editing && <RallyEditDialog key={editing.id} rally={editing} roster={roster} dispatch={dispatch} onClose={() => setEditingId(null)} />}
    </div>
  );
}
