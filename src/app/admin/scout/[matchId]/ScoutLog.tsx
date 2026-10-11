"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { SegmentedButtons } from "@/components/ui/Segmented";
import type { ScoutAction } from "@/lib/scout/actions";
import type { ScoutRally, ScoutView } from "@/lib/scout/derive";
import { playerLabel, rallyText, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import { recordsReceptions } from "@/lib/scout/levels";
import { ERROR_HOWS, HOW_META, POINT_HOWS, rallyWinner } from "@/lib/scout/rules";
import { endsRally, gradeSymbol, TOUCH_SKILLS } from "@/lib/scout/touches";
import { otherSide, type ScoutGrade, type ScoutHow, type ScoutLevel, type ScoutRoster, type ScoutSide, type ScoutTouch } from "@/lib/scout/types";
import { TouchChip } from "./ScoutInputParts";

/**
 * Il registro degli scambi, dal più recente: serve a controllare che sia
 * tutto giusto e a correggere uno scambio (chi, come, a chi) o toglierlo
 * senza dover annullare tutto quello che è venuto dopo. Punteggi e battute si
 * ricalcolano da soli.
 */

/** Come si sta correggendo un tocco prima di salvare. */
interface TouchDraft {
  player: string;
  grade: ScoutGrade;
  zone: string;
  removed: boolean;
}

function draftOf(touch: ScoutTouch): TouchDraft {
  return { player: touch.player ?? "", grade: touch.grade, zone: touch.zone ? String(touch.zone) : "", removed: false };
}

/** Una riga della correzione: un tocco, con chi, il voto e la zona. Il voto cambia solo tra voti che hanno lo stesso effetto sullo scambio. */
function TouchEditRow({
  touch,
  roster,
  draft,
  closing,
  onChange,
}: {
  touch: ScoutTouch;
  roster: ScoutRoster;
  draft: TouchDraft;
  /** È il tocco che ha chiuso lo scambio: non si toglie (si toglie lo scambio). */
  closing: boolean;
  onChange: (patch: Partial<TouchDraft>) => void;
}) {
  const meta = TOUCH_SKILLS[touch.skill];
  const grades = meta.grades.filter((g) => endsRally(touch.skill, g) === endsRally(touch.skill, touch.grade));
  return (
    <li className="space-y-2 rounded-xl border border-border-subtle bg-surface-muted/40 p-2.5" data-scout-touch-edit={touch.id}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-foreground/10 text-[11px] font-extrabold">{meta.letter}</span>
          {meta.label} · {touch.side === "us" ? "noi" : "loro"}
        </span>
        {!closing && (
          <Button variant="danger-ghost" size="icon-sm" onClick={() => onChange({ removed: true })} aria-label={`Togli il tocco: ${meta.label}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={draft.player} onChange={(e) => onChange({ player: e.target.value })} aria-label={`Chi: ${meta.label}`}>
          <option value="">Non indicata</option>
          {sortPlayers(roster[touch.side]).map((p) => (
            <option key={p.id} value={p.id}>
              {playerLabel(roster, touch.side, p.id)}
            </option>
          ))}
        </Select>
        <Select value={draft.grade} onChange={(e) => onChange({ grade: e.target.value as ScoutGrade })} aria-label={`Voto: ${meta.label}`}>
          {grades.map((g) => (
            <option key={g} value={g}>
              {gradeSymbol(g)} {meta.gradeLabels[g]}
            </option>
          ))}
        </Select>
      </div>
      {meta.zone && (
        <Select value={draft.zone} onChange={(e) => onChange({ zone: e.target.value })} aria-label={`Zona: ${meta.label}`}>
          <option value="">Nessuna zona</option>
          {[1, 2, 3, 4, 5, 6].map((zone) => (
            <option key={zone} value={String(zone)}>
              Zona {zone}
            </option>
          ))}
        </Select>
      )}
    </li>
  );
}

function RallyEditDialog({
  rally,
  roster,
  level,
  dispatch,
  onClose,
}: {
  rally: ScoutRally;
  roster: ScoutRoster;
  level: ScoutLevel;
  dispatch: (action: ScoutAction) => void;
  onClose: () => void;
}) {
  const closedByTouch = rally.closedBy === "touch";
  const [actor, setActor] = useState<ScoutSide>(rally.actor);
  const [how, setHow] = useState<ScoutHow>(rally.how);
  const [player, setPlayer] = useState(rally.player ?? "");
  const [victim, setVictim] = useState(rally.victim ?? "");
  const [drafts, setDrafts] = useState<Record<string, TouchDraft>>(() => Object.fromEntries(rally.touches.map((t) => [t.id, draftOf(t)])));
  // La ricezione di un livello che la segna, aggiunta a posteriori a uno scambio in cui riceveva la nostra squadra.
  const canAddReception =
    recordsReceptions(level) && rally.server === "opp" && !rally.touches.some((t) => t.skill === "reception" && t.side === "us");
  const [reception, setReception] = useState<{ player: string; grade: ScoutGrade; zone: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const winner = closedByTouch ? rally.winner : rallyWinner(how, actor);
  const attackers = sortPlayers(roster[otherSide(actor)]);
  const shown = rally.touches.filter((t) => !drafts[t.id]?.removed);

  function save() {
    if (!closedByTouch) {
      dispatch({
        type: "update",
        id: rally.id,
        patch: { actor, how, player: player || null, victim: how === "block" ? victim || null : null },
      });
    }
    for (const touch of rally.touches) {
      const draft = drafts[touch.id];
      if (!draft) continue;
      if (draft.removed) {
        dispatch({ type: "removeTouch", id: touch.id });
      } else if (draft.player !== (touch.player ?? "") || draft.grade !== touch.grade || draft.zone !== (touch.zone ? String(touch.zone) : "")) {
        dispatch({
          type: "updateTouch",
          id: touch.id,
          patch: { player: draft.player || null, grade: draft.grade, zone: draft.zone ? Number(draft.zone) : null },
        });
      }
    }
    if (reception) {
      dispatch({
        type: "insertTouch",
        before: rally.eventIds[0],
        input: { side: "us", skill: "reception", player: reception.player || null, grade: reception.grade, zone: reception.zone ? Number(reception.zone) : null },
        at: Date.now(),
        id: newId(),
      });
    }
    onClose();
  }

  function remove() {
    if (!window.confirm("Togliere questo scambio dal registro? Il punteggio si ricalcola.")) return;
    dispatch({ type: "removeRally", id: rally.id });
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
          {!closedByTouch && (
            <>
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
            </>
          )}

          {rally.touches.length > 0 && (
            <div data-scout-touch-editor>
              <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Tocchi dello scambio</p>
              <ol className="space-y-2">
                {rally.touches.map((touch, index) =>
                  drafts[touch.id]?.removed ? null : (
                    <TouchEditRow
                      key={touch.id}
                      touch={touch}
                      roster={roster}
                      draft={drafts[touch.id]}
                      closing={closedByTouch && index === rally.touches.length - 1}
                      onChange={(patch) => setDrafts((all) => ({ ...all, [touch.id]: { ...all[touch.id], ...patch } }))}
                    />
                  ),
                )}
              </ol>
              {closedByTouch && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Lo scambio è finito con l&apos;ultimo tocco. Per cambiare chi fa punto, togli lo scambio e segnalo di nuovo.
                </p>
              )}
            </div>
          )}

          {canAddReception &&
            (reception ? (
              <div className="space-y-2 rounded-xl border border-primary/30 bg-primary-soft/40 p-2.5" data-scout-add-reception-form>
                <p className="text-sm font-bold text-foreground">Ricezione nostra</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={reception.player} onChange={(e) => setReception({ ...reception, player: e.target.value })} aria-label="Chi ha ricevuto">
                    <option value="">Non indicata</option>
                    {sortPlayers(roster.us).map((p) => (
                      <option key={p.id} value={p.id}>
                        {playerLabel(roster, "us", p.id)}
                      </option>
                    ))}
                  </Select>
                  <Select value={reception.grade} onChange={(e) => setReception({ ...reception, grade: e.target.value as ScoutGrade })} aria-label="Voto della ricezione">
                    {TOUCH_SKILLS.reception.grades
                      .filter((g) => g !== "=")
                      .map((g) => (
                        <option key={g} value={g}>
                          {gradeSymbol(g)} {TOUCH_SKILLS.reception.gradeLabels[g]}
                        </option>
                      ))}
                  </Select>
                </div>
                <Select value={reception.zone} onChange={(e) => setReception({ ...reception, zone: e.target.value })} aria-label="Zona della ricezione">
                  <option value="">Nessuna zona</option>
                  {[1, 2, 3, 4, 5, 6].map((zone) => (
                    <option key={zone} value={String(zone)}>
                      Zona {zone}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setReception({ player: "", grade: "!", zone: "" })} data-scout-add-reception>
                <Plus className="h-4 w-4" />
                Aggiungi la ricezione
              </Button>
            ))}

          <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
            Il punto va a <b>{winner === "us" ? "noi" : "loro"}</b>.
            {shown.length !== rally.touches.length ? ` Togli ${rally.touches.length - shown.length} ${rally.touches.length - shown.length === 1 ? "tocco" : "tocchi"} quando salvi.` : ""}
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

function RallyRow({ rally, roster, onEdit, first }: { rally: ScoutRally; roster: ScoutRoster; onEdit: () => void; first: boolean }) {
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
        {rally.touches.length > 0 && (
          <ol className="mt-1.5 flex flex-wrap gap-1" aria-label="Tocchi dello scambio" data-scout-rally-touches>
            {rally.touches.map((touch) => (
              <li key={touch.id}>
                <TouchChip touch={touch} roster={roster} />
              </li>
            ))}
          </ol>
        )}
      </div>
      <Button
        variant="quiet"
        size="icon-sm"
        onClick={onEdit}
        aria-label={`Correggi lo scambio ${rally.n}`}
        data-tour={first ? "scout-log-edit" : undefined}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

export function ScoutLog({
  view,
  roster,
  level,
  dispatch,
}: {
  view: ScoutView;
  roster: ScoutRoster;
  level: ScoutLevel;
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
            {[...set.rallies].reverse().map((rally, j) => (
              <RallyRow key={rally.id} rally={rally} roster={roster} onEdit={() => setEditingId(rally.id)} first={i === 0 && j === 0} />
            ))}
          </ol>
        </details>
      ))}

      {editing && <RallyEditDialog key={editing.id} rally={editing} roster={roster} level={level} dispatch={dispatch} onClose={() => setEditingId(null)} />}
    </div>
  );
}
