"use client";

import { useState } from "react";
import { Check, Plus, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldHint, Input, Label, Toggle } from "@/components/ui/Field";
import { SegmentedButtons } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { cleanNumber, isManualPlayer, manualPlayer, opponentPlayer, usedPlayerIds, type ScoutAction } from "@/lib/scout/actions";
import { parseJerseyNumbers, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import type { ScoutData, ScoutFormat, ScoutPlayer } from "@/lib/scout/types";

/** Un'atleta del registro, tra cui scegliere chi gioca questa partita. */
export interface ScoutAthlete {
  id: string;
  name: string;
  /** È tra le convocate della partita. */
  calledUp: boolean;
  /** Il numero di maglia scritto nell'anagrafica atlete (null = non ancora assegnato). */
  number: string | null;
}

const FORMATS: { value: ScoutFormat; label: string; hint: string }[] = [
  { value: "bo5", label: "3 set su 5", hint: "Vince chi arriva a 3 set; il quinto è a 15." },
  { value: "bo3", label: "2 set su 3", hint: "Vince chi arriva a 2 set; il terzo è a 15." },
  { value: "fixed3", label: "3 set fissi", hint: "Si giocano sempre tutti e tre i set." },
];

/** Punti di un set: si può scrivere liberamente (anche cancellare e riscrivere), il valore vale solo se è tra 10 e 50. */
function PointsInput({ id, label, value, onCommit }: { id: string; label: string; value: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 2);
          setText(next);
          const parsed = Number(next);
          if (next !== "" && parsed >= 10 && parsed <= 50) onCommit(parsed);
        }}
        onBlur={() => setText(String(value))}
        aria-invalid={text !== "" && (Number(text) < 10 || Number(text) > 50)}
      />
    </div>
  );
}

function PlayerRow({
  player,
  name,
  inRoster,
  used,
  calledUp,
  duplicateNumber,
  registryNumber,
  onToggle,
  onNumber,
  onLibero,
}: {
  player: ScoutPlayer | null;
  name: string;
  inRoster: boolean;
  /** Compare già negli scambi: non si può più togliere. */
  used: boolean;
  calledUp: boolean;
  duplicateNumber: boolean;
  /** Il numero scritto nell'anagrafica, se questa riga non ne ha ancora uno. */
  registryNumber?: string | null;
  onToggle: () => void;
  onNumber: (value: string) => void;
  onLibero: () => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
        inRoster ? "border-primary/30 bg-primary-soft/40" : "border-border-subtle bg-surface",
      )}
      data-scout-athlete={name}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={inRoster}
        aria-label={`${name}: gioca questa partita`}
        title={used ? "Compare già negli scambi: non si può togliere" : undefined}
        disabled={used}
        onClick={onToggle}
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed",
          inRoster ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface",
        )}
      >
        {inRoster && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{name}</span>
      {calledUp && <Badge tone="primary" className="hidden shrink-0 sm:inline-flex">Convocata</Badge>}
      {inRoster && player && (
        <>
          {registryNumber && !player.number && (
            <button
              type="button"
              onClick={() => onNumber(registryNumber)}
              title="Usa il numero scritto nell'anagrafica atlete"
              aria-label={`${name}: usa il numero ${registryNumber} dell'anagrafica`}
              data-scout-use-registry
              className="h-7 shrink-0 rounded-full border border-primary/30 bg-primary-soft px-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
            >
              Usa il {registryNumber}
            </button>
          )}
          <input
            value={player.number ?? ""}
            onChange={(e) => onNumber(e.target.value)}
            inputMode="numeric"
            maxLength={2}
            placeholder="N°"
            aria-label={`Numero di maglia di ${name}`}
            aria-invalid={duplicateNumber}
            title={duplicateNumber ? "Questo numero è già assegnato a un'altra giocatrice" : undefined}
            className={cn(
              "tabular h-9 w-14 shrink-0 rounded-lg border bg-surface px-2 text-center text-base font-bold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/12 sm:text-sm",
              duplicateNumber ? "border-destructive" : "border-input focus:border-primary",
            )}
          />
          <button
            type="button"
            aria-pressed={player.libero}
            aria-label={`${name}: libero`}
            title="Libero"
            onClick={onLibero}
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg border text-sm font-extrabold transition-colors",
              player.libero
                ? "border-sand-400 bg-accent text-accent-foreground"
                : "border-border-subtle bg-surface text-muted-foreground hover:bg-muted",
            )}
          >
            L
          </button>
        </>
      )}
    </li>
  );
}

/**
 * Prima di cominciare (e quando serve correggere): chi gioca, con numero di
 * maglia e libero; i numeri dell'avversaria; le regole della gara. Tutto si
 * può cambiare anche a partita iniziata, tranne togliere chi ha già
 * un'azione registrata.
 */
export function ScoutSetup({
  data,
  athletes,
  dispatch,
}: {
  data: ScoutData;
  athletes: ScoutAthlete[];
  dispatch: (action: ScoutAction) => void;
}) {
  const [manualName, setManualName] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [oppText, setOppText] = useState("");

  const used = usedPlayerIds(data);
  const rosterById = new Map(data.roster.us.map((p) => [p.id, p]));
  const numberCount = new Map<string, number>();
  for (const p of data.roster.us) if (p.number) numberCount.set(p.number, (numberCount.get(p.number) ?? 0) + 1);
  const isDuplicate = (p: ScoutPlayer | null) => Boolean(p?.number && (numberCount.get(p.number) ?? 0) > 1);

  const registryIds = new Set(athletes.map((a) => a.id));
  // In rosa ma non (più) nel registro, o scritte a mano.
  const extras = sortPlayers(data.roster.us.filter((p) => isManualPlayer(p.id) || !registryIds.has(p.id)));
  const called = athletes.filter((a) => a.calledUp);
  const others = athletes.filter((a) => !a.calledUp);

  function toggleAthlete(a: ScoutAthlete) {
    if (rosterById.has(a.id)) dispatch({ type: "removePlayer", side: "us", id: a.id });
    else dispatch({ type: "addPlayer", side: "us", player: { id: a.id, name: a.name, number: a.number, libero: false } });
  }

  /** Giocatrici già in rosa senza numero a cui l'anagrafica ne assegna uno. */
  const fillable = athletes.filter((a) => a.number && rosterById.has(a.id) && !rosterById.get(a.id)?.number);
  function fillFromRegistry() {
    for (const a of fillable) dispatch({ type: "updatePlayer", side: "us", id: a.id, patch: { number: a.number } });
  }

  function addManual() {
    const name = manualName.trim();
    if (!name) return;
    dispatch({ type: "addPlayer", side: "us", player: manualPlayer(newId(), name, cleanNumber(manualNumber)) });
    setManualName("");
    setManualNumber("");
  }

  function addOpponents() {
    for (const number of parseJerseyNumbers(oppText)) {
      dispatch({ type: "addPlayer", side: "opp", player: opponentPlayer(number) });
    }
    setOppText("");
  }

  const renderAthlete = (a: ScoutAthlete) => {
    const player = rosterById.get(a.id) ?? null;
    return (
      <PlayerRow
        key={a.id}
        player={player}
        name={a.name}
        inRoster={Boolean(player)}
        used={used.has(a.id)}
        calledUp={a.calledUp}
        duplicateNumber={isDuplicate(player)}
        registryNumber={a.number}
        onToggle={() => toggleAthlete(a)}
        onNumber={(value) => dispatch({ type: "updatePlayer", side: "us", id: a.id, patch: { number: cleanNumber(value) } })}
        onLibero={() => dispatch({ type: "updatePlayer", side: "us", id: a.id, patch: { libero: !player?.libero } })}
      />
    );
  };

  const oppPlayers = sortPlayers(data.roster.opp);

  return (
    <div className="space-y-5" data-scout-setup>
      <Card data-tour="scout-setup-roster">
        <CardHeader className="pb-3">
          <CardTitle>Le nostre giocatrici</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Spunta chi gioca. Il numero di maglia arriva da solo dall&apos;anagrafica atlete (lo scrivi lì una volta); qui lo puoi
            cambiare solo per questa partita. Non è obbligatorio: puoi anche segnare i punti senza dire chi li fa.
          </p>
          {fillable.length > 1 && (
            <div className="mt-2.5">
              <Button variant="outline" size="sm" onClick={fillFromRegistry} data-scout-fill-registry>
                Compila i numeri dall&apos;anagrafica ({fillable.length})
              </Button>
            </div>
          )}
        </CardHeader>
        <CardBody className="space-y-3">
          {athletes.length === 0 && extras.length === 0 && (
            <p className="rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-muted-foreground">
              Nel registro non ci sono atlete attive per questa squadra: scrivi i nomi qui sotto.
            </p>
          )}
          {called.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Convocate</p>
              <ul className="space-y-1.5">{called.map(renderAthlete)}</ul>
            </div>
          )}
          {others.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {called.length > 0 ? "Altre atlete" : "Atlete"}
              </p>
              <ul className="space-y-1.5">{others.map(renderAthlete)}</ul>
            </div>
          )}
          {extras.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Scritte a mano</p>
              <ul className="space-y-1.5">
                {extras.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    name={p.name}
                    inRoster
                    used={used.has(p.id)}
                    calledUp={false}
                    duplicateNumber={isDuplicate(p)}
                    onToggle={() => dispatch({ type: "removePlayer", side: "us", id: p.id })}
                    onNumber={(value) => dispatch({ type: "updatePlayer", side: "us", id: p.id, patch: { number: cleanNumber(value) } })}
                    onLibero={() => dispatch({ type: "updatePlayer", side: "us", id: p.id, patch: { libero: !p.libero } })}
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManual();
                }
              }}
              placeholder="Aggiungi a mano"
              aria-label="Nome di una giocatrice da aggiungere a mano"
              maxLength={60}
              className="min-w-0"
            />
            <Input
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManual();
                }
              }}
              inputMode="numeric"
              maxLength={2}
              placeholder="N°"
              aria-label="Numero di maglia della giocatrice da aggiungere a mano"
              className="w-16 shrink-0 text-center"
            />
            <Button variant="outline" onClick={addManual} disabled={!manualName.trim()}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Aggiungi</span>
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card data-tour="scout-setup-opp">
        <CardHeader className="pb-3">
          <CardTitle>L&apos;avversaria</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Di solito basta il numero di maglia. Puoi scriverli adesso o aggiungerli man mano mentre segni i punti.
          </p>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={oppText}
              onChange={(e) => setOppText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOpponents();
                }
              }}
              inputMode="numeric"
              placeholder="Numeri di maglia, es. 1 4 7 9 12"
              aria-label="Numeri di maglia dell'avversaria"
              className="min-w-0"
            />
            <Button variant="outline" onClick={addOpponents} disabled={parseJerseyNumbers(oppText).length === 0}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Aggiungi</span>
            </Button>
          </div>
          {oppPlayers.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Numeri dell'avversaria">
              {oppPlayers.map((p) => (
                <li key={p.id}>
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-3 pr-1.5 text-sm font-bold text-accent-foreground"
                    data-scout-opponent={p.number}
                  >
                    {p.number ?? p.name}
                    <button
                      type="button"
                      disabled={used.has(p.id)}
                      onClick={() => dispatch({ type: "removePlayer", side: "opp", id: p.id })}
                      aria-label={`Togli il numero ${p.number ?? p.name}`}
                      title={used.has(p.id) ? "Compare già negli scambi: non si può togliere" : undefined}
                      className="grid h-5 w-5 place-items-center rounded-full text-accent-foreground/70 transition-colors hover:bg-black/10 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card data-tour="scout-setup-rules">
        <CardHeader className="pb-3">
          <CardTitle>Regole della gara</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Formula</p>
            <SegmentedButtons
              ariaLabel="Formula della gara"
              value={data.settings.format}
              onChange={(format) => dispatch({ type: "settings", patch: { format } })}
              items={FORMATS.map((f) => ({ value: f.value, label: f.label }))}
            />
            <FieldHint>{FORMATS.find((f) => f.value === data.settings.format)?.hint}</FieldHint>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <PointsInput
              id="scout-set-points"
              label="Punti per set"
              value={data.settings.setPoints}
              onCommit={(setPoints) => dispatch({ type: "settings", patch: { setPoints } })}
            />
            <PointsInput
              id="scout-last-set-points"
              label="Ultimo set"
              value={data.settings.lastSetPoints}
              onCommit={(lastSetPoints) => dispatch({ type: "settings", patch: { lastSetPoints } })}
            />
          </div>
          <FieldHint>
            Si vince un set arrivando al limite con almeno due punti di scarto. L&apos;ultimo set è a 15; con tre set fissi lo stabilisce il regolamento
            della gara (15 o 25).
          </FieldHint>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-foreground/80">Chi batte per primo nel 1° set</p>
            <SegmentedButtons
              ariaLabel="Chi batte per primo"
              value={data.settings.firstServer}
              onChange={(firstServer) => dispatch({ type: "settings", patch: { firstServer } })}
              items={[
                { value: "us", label: "Noi" },
                { value: "opp", label: "Loro" },
              ]}
            />
            <FieldHint>Dal 2° set si sceglie a fine set (di norma si alternano).</FieldHint>
          </div>
        </CardBody>
      </Card>

      <Card data-tour="section-scout-live">
        <CardHeader className="pb-3">
          <CardTitle>Punteggio live sul sito</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Chi apre il sito della squadra vede la partita in diretta, come con il Live score.
          </p>
        </CardHeader>
        <CardBody>
          <Toggle
            label="Mostra il punteggio sul sito pubblico"
            description="Solo le due squadre, i punti, i set e chi batte (risultato non ufficiale): mai nomi, numeri di maglia o dettagli degli scambi. Compare dal primo punto segnato e lo spegni quando vuoi."
            checked={data.settings.publicLive}
            onChange={(e) => dispatch({ type: "settings", patch: { publicLive: e.target.checked } })}
            data-scout-public-live
          />
        </CardBody>
      </Card>
    </div>
  );
}
