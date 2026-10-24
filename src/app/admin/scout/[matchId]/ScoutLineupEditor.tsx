"use client";

import { useEffect, useState, type MutableRefObject, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldHint, Label, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { cleanNumber, opponentPlayer, type ScoutAction } from "@/lib/scout/actions";
import { lineupWrittenThisSet } from "@/lib/scout/court";
import type { ScoutCourt, ScoutView } from "@/lib/scout/derive";
import { shortName, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import type { ScoutData, ScoutPlayer, ScoutSide } from "@/lib/scout/types";
import type { CourtPosition, VolleyRole } from "@/lib/types";
import { CourtNet, CourtThreeMeterLine } from "./ScoutCourtPicker";
import { Sheet } from "./ScoutSheet";
import type { ScoutAthlete } from "./ScoutSetup";

/** La formazione di un set salvata nella sezione Partite: chi sta in ogni posizione, i ruoli (le centrali sono «MB») e la libero. */
export interface SavedScoutLineup {
  athleteIds: (string | null)[];
  roles: (VolleyRole | null)[];
  liberoId: string | null;
}

/** Quello che si sta scrivendo per una squadra: per noi gli id della rosa, per l'avversaria i numeri di maglia. */
interface Draft {
  positions: string[];
  libero: string;
  hosts: [string, string];
}

/** L'istante in cui si scrive una formazione: si chiama solo da un tocco o da «Comincia», mai mentre si disegna la pagina. */
const clock = () => Date.now();

const emptyDraft = (): Draft => ({ positions: ["", "", "", "", "", ""], libero: "", hosts: ["", ""] });

const FIELD =
  "w-full rounded-full bg-white/95 px-2 py-2 text-center text-[13px] font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700";

/**
 * Ogni squadra ha la sua metà campo, vista dalla sua parte con la rete in alto (davanti 4-3-2, dietro 5-6-1), come nella finestra
 * «chi?», e le due metà stanno una sopra l'altra: le sei caselle sono larghe uguali e chi sta a rete si legge. Nel campo intero in
 * orizzontale la fila a rete è larga un terzo (come le misure vere) e, anche su un tablet, i nomi non ci stavano.
 */
const SPOTS: Record<CourtPosition, { row: number; column: number }> = {
  1: { row: 3, column: 3 },
  2: { row: 1, column: 3 },
  3: { row: 1, column: 2 },
  4: { row: 1, column: 1 },
  5: { row: 3, column: 1 },
  6: { row: 3, column: 2 },
};

function LineupHalf({ side, renderCell }: { side: ScoutSide; renderCell: (position: CourtPosition) => ReactNode }) {
  const ours = side === "us";
  return (
    <div
      className={cn("rounded-2xl border p-2.5", ours ? "border-primary/25 bg-primary-soft/60" : "border-sand-400/50 bg-accent/50")}
      data-scout-lineup-half={side}
    >
      <p className={cn("mb-2 text-[13px] font-bold", ours ? "text-primary" : "text-accent-foreground")}>{ours ? "Noi" : "Loro"}</p>
      <CourtNet />
      {/* Nel DOM le posizioni vanno in ordine (1, 2, 3…): con Invio si scrive la formazione di seguito, dalla battitrice in poi. */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-2">
        <div className="col-span-3" style={{ gridRow: 2 }}>
          <CourtThreeMeterLine />
        </div>
        {([1, 2, 3, 4, 5, 6] as const).map((position) => (
          <div
            key={position}
            data-court-position={position}
            className="relative min-w-0 rounded-xl border border-border-subtle bg-sand-500 px-1.5 pb-1.5 pt-5"
            style={{ gridRow: SPOTS[position].row, gridColumn: SPOTS[position].column }}
          >
            <span className="absolute left-2 top-1 text-[10px] font-bold leading-4 text-white">
              {position}
              {position === 1 ? " · batte" : ""}
            </span>
            {renderCell(position)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Invio in un numero: passa al campo dopo, nell'ordine delle posizioni (le due squadre una di seguito all'altra). */
function focusNextOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-scout-lineup] [data-court-position] input, [data-scout-lineup] [data-court-position] select"));
  const index = fields.indexOf(e.currentTarget);
  if (index < 0) return;
  e.preventDefault();
  fields[index + 1]?.focus();
}

function numberOf(roster: ScoutPlayer[], id: string | null | undefined): string {
  if (!id) return "";
  return roster.find((p) => p.id === id)?.number ?? "";
}

/** La formazione che si sta seguendo (o con cui è cominciato un set), pronta da correggere. Senza formazione, vuota. */
function draftFromCourt(side: ScoutSide, court: ScoutCourt | null, data: ScoutData): Draft {
  if (!court) return emptyDraft();
  if (side === "us") return { positions: [...court.positions], libero: court.libero ?? "", hosts: [...court.hosts] };
  const opp = data.roster.opp;
  return {
    positions: court.positions.map((id) => numberOf(opp, id)),
    libero: numberOf(opp, court.libero),
    hosts: [numberOf(opp, court.hosts[0]), numberOf(opp, court.hosts[1])],
  };
}

/** La formazione preparata in Partite per un set: le centrali («MB») sono le due che la libero sostituisce. */
function draftFromSaved(saved: SavedScoutLineup): Draft {
  const centrals = saved.athleteIds.filter((id, i): id is string => Boolean(id) && saved.roles[i] === "MB");
  return {
    positions: Array.from({ length: 6 }, (_, i) => saved.athleteIds[i] ?? ""),
    libero: saved.liberoId ?? "",
    hosts: [centrals[0] ?? "", centrals[1] ?? ""],
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return a.libero === b.libero && a.positions.every((id, i) => id === b.positions[i]) && a.hosts.every((id, i) => id === b.hosts[i]);
}

/** Da dove viene quello che si vede scritto: la formazione di Partite, quella del set prima, o niente di particolare. */
type Source = "saved" | "previous" | "carried" | null;

/**
 * La formazione in campo, come nel Live score: chi gioca nelle posizioni 1…6
 * (la 1 è chi batte, poi in senso orario), la libero e le due giocatrici che
 * sostituisce. È facoltativa e vale per le squadre in cui la scrivi: da lì lo
 * Scout segue da solo le rotazioni, la libero e i cambi, propone chi batte e ti
 * fa scegliere le giocatrici dal campo.
 *
 * Si parte da quello che c'è già: la formazione preparata in Partite per questo set (niente da riscrivere), altrimenti
 * quella del set prima, altrimenti quella che si sta seguendo. Sta in due posti: come scheda nella preparazione
 * (`variant="card"`) e come finestra «Formazione del N° set» (`variant="sheet"`), che si apre da sola a ogni set nuovo.
 */
export function ScoutLineupEditor({
  data,
  view,
  athletes,
  saved,
  dispatch,
  variant = "card",
  onDone,
  commitRef,
}: {
  data: ScoutData;
  view: ScoutView;
  athletes: ScoutAthlete[];
  /** Le formazioni salvate in Partite, una per set (vuote se non ce n'è). */
  saved: SavedScoutLineup[];
  dispatch: (action: ScoutAction) => void;
  variant?: "card" | "sheet";
  /** Dopo «Conferma»: la finestra si chiude. */
  onDone?: () => void;
  /**
   * Chi apre e chiude la preparazione («Comincia», «Fatto») ci mette dentro la funzione che applica quello che è scritto e non
   * ancora confermato: così non resta una formazione scritta e dimenticata.
   */
  commitRef?: MutableRefObject<(() => void) | null>;
}) {
  const cur = view.current;
  const fresh = cur ? cur.rallies.length === 0 : false;
  const previous = cur && cur.n > 1 ? view.sets[cur.n - 2] : null;
  const savedForSet = cur ? saved[cur.n - 1] : undefined;
  const savedHasPlayers = Boolean(savedForSet && savedForSet.athleteIds.some(Boolean));
  const written = lineupWrittenThisSet(data.events);
  // Prima formazione del set e in Partite ce n'è una per questo set: si parte da quella.
  const fromSaved = fresh && savedHasPlayers && !written;
  const carried = fresh && Boolean(cur && cur.n > 1) && !written && Boolean(view.court.us || view.court.opp);

  const [us, setUs] = useState<Draft>(() => (fromSaved && savedForSet ? draftFromSaved(savedForSet) : draftFromCourt("us", view.court.us, data)));
  const [opp, setOpp] = useState<Draft>(() => draftFromCourt("opp", view.court.opp, data));
  const [source, setSource] = useState<Source>(fromSaved ? "saved" : carried ? "carried" : null);
  const [done, setDone] = useState(false);

  // Chi è nella formazione ma non è ancora in rosa (la formazione di Partite): entra in rosa con «Conferma».
  const inRoster = new Set(data.roster.us.map((p) => p.id));
  const extras: ScoutPlayer[] = [...new Set([...us.positions, us.libero, ...us.hosts].filter(Boolean))]
    .filter((id) => !inRoster.has(id))
    .flatMap((id) => {
      const athlete = athletes.find((a) => a.id === id);
      return athlete ? [{ id: athlete.id, name: athlete.name, number: athlete.number, libero: id === us.libero }] : [];
    });
  const roster = sortPlayers([...data.roster.us, ...extras]);
  const onCourtUs = new Set(us.positions.filter(Boolean));
  const usPlayers = roster.filter((p) => !p.libero);
  const liberoChoices = roster.filter((p) => !onCourtUs.has(p.id));
  const hasCourt = Boolean(view.court.us || view.court.opp);
  const draftHasAny = us.positions.some(Boolean) || opp.positions.some((n) => cleanNumber(n));
  const previousHadLineup = Boolean(previous && (previous.lineups.us || previous.lineups.opp));
  const dirty = !sameDraft(us, draftFromCourt("us", view.court.us, data)) || !sameDraft(opp, draftFromCourt("opp", view.court.opp, data));

  function touch<T>(setter: (value: T) => void, value: T) {
    setDone(false);
    setSource(null);
    setter(value);
  }

  function setUsPosition(index: number, id: string) {
    const positions = us.positions.map((current, i) => (i === index ? id : id && current === id ? "" : current));
    touch(setUs, { ...us, positions, libero: id && us.libero === id ? "" : us.libero });
  }

  function setOppPosition(index: number, value: string) {
    const number = value.replace(/\D/g, "").slice(0, 2);
    touch(setOpp, { ...opp, positions: opp.positions.map((current, i) => (i === index ? number : current)) });
  }

  function applySaved() {
    if (!savedForSet) return;
    touch(setUs, draftFromSaved(savedForSet));
    setSource("saved");
  }

  /** Come nel set prima: le formazioni con cui è cominciato (per noi e per loro), con la libero di adesso se è stata cambiata. */
  function applyPrevious() {
    if (!previous) return;
    const ours = draftFromCourt("us", previous.lineups.us, data);
    if (ours.positions.some(Boolean) && view.court.us?.libero && !ours.positions.includes(view.court.us.libero)) ours.libero = view.court.us.libero;
    touch(setUs, ours);
    touch(setOpp, draftFromCourt("opp", previous.lineups.opp, data));
    setSource("previous");
  }

  /** Scrive la formazione (una per squadra) e porta in rosa chi manca. `at` è l'istante in cui la si scrive. */
  function apply(at: number) {
    // 0) chi viene dalla formazione preparata in Partite entra in rosa, con il numero dell'anagrafica.
    for (const player of extras) dispatch({ type: "addPlayer", side: "us", player });
    // 1) l'avversaria: i numeri scritti entrano nella rosa, se non ci sono già.
    const oppNumbers = [...opp.positions, opp.libero].map((n) => cleanNumber(n)).filter((n): n is string => n !== null);
    for (const number of new Set(oppNumbers)) {
      if (!data.roster.opp.some((p) => p.id === `opp-${number}`)) dispatch({ type: "addPlayer", side: "opp", player: opponentPlayer(number) });
    }
    const oppId = (n: string) => {
      const number = cleanNumber(n);
      return number ? `opp-${number}` : null;
    };
    // 2) la libero nostra si segna come tale nella rosa (così non attacca né batte).
    if (us.libero) {
      const player = data.roster.us.find((p) => p.id === us.libero);
      if (player && !player.libero) dispatch({ type: "updatePlayer", side: "us", id: player.id, patch: { libero: true } });
    }
    // 3) una formazione per squadra, solo se almeno una posizione è scritta; senza nessuna la squadra non si segue.
    const usAny = us.positions.some(Boolean);
    const oppAny = opp.positions.some((n) => cleanNumber(n));
    if (usAny || view.court.us) {
      dispatch({
        type: "lineup",
        side: "us",
        input: { positions: us.positions.map((id) => id || null), libero: us.libero || null, hosts: [us.hosts[0] || null, us.hosts[1] || null] },
        at,
        id: newId(),
      });
    }
    if (oppAny || view.court.opp) {
      dispatch({
        type: "lineup",
        side: "opp",
        input: { positions: opp.positions.map(oppId), libero: oppId(opp.libero), hosts: [oppId(opp.hosts[0]), oppId(opp.hosts[1])] },
        at,
        id: newId(),
      });
    }
  }

  function confirm() {
    apply(clock());
    setDone(true);
    onDone?.();
  }

  // «Comincia» / «Fatto»: quello che è scritto e non ancora confermato si applica da solo (aggiornato a ogni disegno, per non usare dati vecchi).
  useEffect(() => {
    if (!commitRef) return;
    commitRef.current = () => {
      if (dirty) apply(clock());
    };
    return () => {
      commitRef.current = null;
    };
  });

  function stopTracking() {
    const at = Date.now();
    for (const side of ["us", "opp"] as const) {
      if (view.court[side]) {
        dispatch({ type: "lineup", side, input: { positions: [null, null, null, null, null, null], libero: null, hosts: [null, null] }, at, id: newId() });
      }
    }
    setUs(emptyDraft());
    setOpp(emptyDraft());
    setSource(null);
    setDone(false);
  }

  const oppOnCourt = opp.positions.filter((n) => cleanNumber(n));
  const usCell = (position: CourtPosition) => (
    <select
      value={us.positions[position - 1] ?? ""}
      onChange={(e) => setUsPosition(position - 1, e.target.value)}
      aria-label={`Noi, posizione ${position}`}
      data-scout-lineup-cell={`us-${position}`}
      className={FIELD}
    >
      <option value="">—</option>
      {usPlayers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.number ? `${p.number} · ${shortName(p, roster)}` : p.name}
        </option>
      ))}
    </select>
  );
  const oppCell = (position: CourtPosition) => (
    <input
      value={opp.positions[position - 1] ?? ""}
      onChange={(e) => setOppPosition(position - 1, e.target.value)}
      onKeyDown={focusNextOnEnter}
      inputMode="numeric"
      enterKeyHint="next"
      placeholder="N."
      aria-label={`Loro, posizione ${position}`}
      data-scout-lineup-cell={`opp-${position}`}
      className={FIELD}
    />
  );

  const note =
    cur && source === "saved"
      ? `È quella preparata in «Partite» per il ${cur.n}° set: controllala e conferma.`
      : source === "previous"
        ? "Come nel set precedente."
        : source === "carried"
          ? "Per ora è quella del set precedente: cambia solo chi serve e conferma."
          : null;

  const body = !cur ? (
    <p className="rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-muted-foreground">La partita è finita: la formazione non si può più cambiare.</p>
  ) : (
    <>
      <div>
        <p className="text-[13px] font-semibold text-foreground/80" data-scout-lineup-scope>
          {fresh
            ? `Formazione di partenza del ${cur.n}° set.`
            : `${cur.n}° set già cominciato: quello che scrivi corregge chi è in campo adesso (le rotazioni fatte restano).`}
        </p>
        {note && (
          <p className="mt-0.5 text-[13px] text-muted-foreground" data-scout-lineup-source={source ?? undefined}>
            {note}
          </p>
        )}
      </div>

      <div className="space-y-3" data-scout-lineup-halves>
        <LineupHalf side="us" renderCell={usCell} />
        <LineupHalf side="opp" renderCell={oppCell} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-2xl border border-border-subtle bg-surface p-3">
          <p className="text-[13px] font-bold text-primary">Noi</p>
          <div>
            <Label htmlFor="scout-lineup-us-libero">Libero</Label>
            <Select id="scout-lineup-us-libero" value={us.libero} onChange={(e) => touch(setUs, { ...us, libero: e.target.value })}>
              <option value="">Nessuna</option>
              {liberoChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number ? `${p.number} · ${p.name}` : p.name}
                </option>
              ))}
            </Select>
          </div>
          {us.libero && (
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map((index) => (
                <div key={index}>
                  <Label htmlFor={`scout-lineup-us-host${index + 1}`}>{index + 1}ª centrale</Label>
                  <Select
                    id={`scout-lineup-us-host${index + 1}`}
                    value={us.hosts[index]}
                    onChange={(e) => touch(setUs, { ...us, hosts: us.hosts.map((h, i) => (i === index ? e.target.value : h)) as [string, string] })}
                  >
                    <option value="">…</option>
                    {us.positions.filter(Boolean).map((id) => {
                      const p = roster.find((x) => x.id === id);
                      return (
                        <option key={id} value={id}>
                          {p ? (p.number ? `${p.number} · ${p.name}` : p.name) : id}
                        </option>
                      );
                    })}
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-border-subtle bg-surface p-3">
          <p className="text-[13px] font-bold text-accent-foreground">Loro (libero e centrali: facoltativi)</p>
          <div>
            <Label htmlFor="scout-lineup-opp-libero">Numero della libero</Label>
            <input
              id="scout-lineup-opp-libero"
              value={opp.libero}
              onChange={(e) => touch(setOpp, { ...opp, libero: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              inputMode="numeric"
              placeholder="N."
              className="w-full rounded-xl border border-input bg-surface px-3.5 py-2 text-base leading-6 text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12 sm:text-sm"
            />
          </div>
          {opp.libero && (
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map((index) => (
                <div key={index}>
                  <Label htmlFor={`scout-lineup-opp-host${index + 1}`}>{index + 1}ª centrale</Label>
                  <Select
                    id={`scout-lineup-opp-host${index + 1}`}
                    value={opp.hosts[index]}
                    onChange={(e) => touch(setOpp, { ...opp, hosts: opp.hosts.map((h, i) => (i === index ? e.target.value : h)) as [string, string] })}
                  >
                    <option value="">…</option>
                    {oppOnCourt.map((n) => (
                      <option key={n} value={cleanNumber(n) ?? n}>
                        n. {n}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <FieldHint>
        La libero sostituisce chi sta in seconda linea, senza limiti di cambi, e non batte mai: se in battuta c&apos;è una centrale, batte lei e la libero
        entra al suo posto quando la squadra torna a ricevere. Esce quando la centrale ruota a rete.
      </FieldHint>

      {/* Nella finestra il pulsante per confermare resta in fondo, in vista, anche scorrendo i campi. Il «sticky» si ferma dove
       * comincia il margine interno della finestra: con -bottom pari a quel margine sta proprio sul bordo, e i campi non
       * scorrono più sotto di lui. */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          variant === "sheet" && "sticky -bottom-4 z-10 -mx-4 -mb-4 border-t border-border-subtle bg-surface px-4 py-3 sm:-bottom-5 sm:-mx-5 sm:-mb-5 sm:px-5",
        )}
      >
        <Button onClick={confirm} data-scout-lineup-confirm>
          <Check className="h-4 w-4" />
          {variant === "sheet" && fresh ? `Conferma e comincia il ${cur.n}° set` : "Conferma la formazione"}
        </Button>
        {savedHasPlayers && source !== "saved" && (
          <Button variant="outline" onClick={applySaved} data-scout-lineup-saved>
            Usa la formazione salvata del {cur.n}° set
          </Button>
        )}
        {fresh && previousHadLineup && source !== "previous" && source !== "carried" && (
          <Button variant="outline" onClick={applyPrevious} data-scout-lineup-previous>
            Come nel set precedente
          </Button>
        )}
        {(hasCourt || draftHasAny) && (
          <Button variant="ghost" onClick={stopTracking} data-scout-lineup-stop>
            Non seguire la formazione
          </Button>
        )}
        {done && (
          <span className={cn("text-sm font-semibold text-success")} role="status" data-scout-lineup-done>
            Formazione salvata.
          </span>
        )}
      </div>
    </>
  );

  if (variant === "sheet") {
    return (
      <div className="space-y-4" data-scout-lineup>
        {body}
      </div>
    );
  }

  return (
    <Card data-tour="scout-setup-lineup" data-scout-lineup>
      <CardHeader className="pb-3">
        <CardTitle>Formazione in campo</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Scrivi chi gioca nelle posizioni da 1 a 6 (la 1 è chi batte, poi in senso orario), la libero e le due giocatrici che sostituisce (di solito le
          centrali). Lo Scout poi ruota da solo, fa entrare la libero, conta i cambi e ti fa scegliere chi ha giocato tra le sei in campo. Se in «Partite» hai
          già preparato la formazione, la trovi già scritta: controlla e vai avanti. Se non ti serve, lasciala vuota.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">{body}</CardBody>
    </Card>
  );
}

/**
 * La formazione in una finestra: si apre da sola a ogni set nuovo («Formazione del 2° set», già scritta come quella del set prima
 * o come l'hai preparata in Partite) e dal pulsante «Formazione» in qualunque momento. Chiusa senza confermare, il set parte
 * comunque dalla formazione del set prima.
 */
export function ScoutLineupSheet({
  data,
  view,
  athletes,
  saved,
  dispatch,
  onClose,
}: {
  data: ScoutData;
  view: ScoutView;
  athletes: ScoutAthlete[];
  saved: SavedScoutLineup[];
  dispatch: (action: ScoutAction) => void;
  onClose: () => void;
}) {
  const cur = view.current;
  const fresh = cur ? cur.rallies.length === 0 : false;
  return (
    <Sheet
      title={cur && fresh ? `Formazione del ${cur.n}° set` : "Formazione in campo"}
      subtitle={cur && fresh && cur.n > 1 ? "Ogni set si può cominciare con una formazione diversa: controlla e conferma." : undefined}
      onClose={onClose}
      testId="lineup"
      wide
      closeOnBackdrop={false}
    >
      <ScoutLineupEditor data={data} view={view} athletes={athletes} saved={saved} dispatch={dispatch} variant="sheet" onDone={onClose} />
    </Sheet>
  );
}
