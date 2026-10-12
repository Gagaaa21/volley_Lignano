"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { DualLiveScoreCourt } from "@/app/admin/livescore/LiveScoreCourt";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { FieldHint, Label, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { cleanNumber, opponentPlayer, type ScoutAction } from "@/lib/scout/actions";
import type { ScoutView } from "@/lib/scout/derive";
import { shortName, sortPlayers } from "@/lib/scout/describe";
import { newId } from "@/lib/scout/id";
import type { ScoutData, ScoutPlayer, ScoutSide } from "@/lib/scout/types";
import type { CourtPosition, VolleyRole } from "@/lib/types";
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

const EMPTY: Draft = { positions: ["", "", "", "", "", ""], libero: "", hosts: ["", ""] };

const FIELD =
  "w-full rounded-full bg-white/95 px-2 py-1.5 text-center text-xs font-bold text-sea-950 shadow-sm outline-none placeholder:text-sea-950/35 focus:ring-2 focus:ring-sea-700";

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

function draftFor(side: ScoutSide, view: ScoutView, data: ScoutData): Draft {
  const court = view.court[side];
  if (!court) return { ...EMPTY, positions: [...EMPTY.positions] };
  if (side === "us") return { positions: [...court.positions], libero: court.libero ?? "", hosts: [...court.hosts] };
  const opp = data.roster.opp;
  return {
    positions: court.positions.map((id) => numberOf(opp, id)),
    libero: numberOf(opp, court.libero),
    hosts: [numberOf(opp, court.hosts[0]), numberOf(opp, court.hosts[1])],
  };
}

/**
 * La formazione in campo, come nel Live score: chi gioca nelle posizioni 1…6
 * (la 1 è chi batte, poi in senso orario), la libero e le due giocatrici che
 * sostituisce. È facoltativa e vale per le squadre in cui la scrivi: da lì lo
 * Scout segue da solo le rotazioni, la libero e i cambi, propone chi batte e ti
 * fa scegliere le giocatrici dal campo.
 */
export function ScoutLineupEditor({
  data,
  view,
  athletes,
  saved,
  dispatch,
}: {
  data: ScoutData;
  view: ScoutView;
  athletes: ScoutAthlete[];
  /** Le formazioni salvate in Partite, una per set (vuote se non ce n'è). */
  saved: SavedScoutLineup[];
  dispatch: (action: ScoutAction) => void;
}) {
  const [us, setUs] = useState<Draft>(() => draftFor("us", view, data));
  const [opp, setOpp] = useState<Draft>(() => draftFor("opp", view, data));
  const [done, setDone] = useState(false);

  const cur = view.current;
  const fresh = cur ? cur.rallies.length === 0 : false;
  const roster = sortPlayers(data.roster.us);
  const onCourtUs = new Set(us.positions.filter(Boolean));
  const usPlayers = roster.filter((p) => !p.libero);
  const liberoChoices = roster.filter((p) => !onCourtUs.has(p.id));
  const savedForSet = cur ? saved[cur.n - 1] : undefined;
  const savedHasPlayers = Boolean(savedForSet && savedForSet.athleteIds.some(Boolean));
  const hasCourt = Boolean(view.court.us || view.court.opp);

  function touch<T>(setter: (value: T) => void, value: T) {
    setDone(false);
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

  function useSaved() {
    if (!savedForSet) return;
    const ids = [...savedForSet.athleteIds, savedForSet.liberoId].filter((id): id is string => Boolean(id));
    // Chi non è ancora in rosa ci entra, con il numero dell'anagrafica.
    for (const id of ids) {
      if (data.roster.us.some((p) => p.id === id)) continue;
      const athlete = athletes.find((a) => a.id === id);
      if (athlete) dispatch({ type: "addPlayer", side: "us", player: { id: athlete.id, name: athlete.name, number: athlete.number, libero: id === savedForSet.liberoId } });
    }
    const centrals = savedForSet.athleteIds.filter((id, i): id is string => Boolean(id) && savedForSet.roles[i] === "MB");
    touch(setUs, {
      positions: Array.from({ length: 6 }, (_, i) => savedForSet.athleteIds[i] ?? ""),
      libero: savedForSet.liberoId ?? "",
      hosts: [centrals[0] ?? "", centrals[1] ?? ""],
    });
  }

  function confirm() {
    const at = Date.now();
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
    setDone(true);
  }

  function stopTracking() {
    const at = Date.now();
    for (const side of ["us", "opp"] as const) {
      if (view.court[side]) {
        dispatch({ type: "lineup", side, input: { positions: [null, null, null, null, null, null], libero: null, hosts: [null, null] }, at, id: newId() });
      }
    }
    setUs({ ...EMPTY, positions: [...EMPTY.positions] });
    setOpp({ ...EMPTY, positions: [...EMPTY.positions] });
    setDone(false);
  }

  const oppOnCourt = opp.positions.filter((n) => cleanNumber(n));

  return (
    <Card data-tour="scout-setup-lineup" data-scout-lineup>
      <CardHeader className="pb-3">
        <CardTitle>Formazione in campo (facoltativa)</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Come nel Live score: scrivi chi gioca nelle posizioni da 1 a 6 (la 1 è chi batte, poi in senso orario), la libero e le due giocatrici che
          sostituisce (di solito le centrali). Lo Scout segue da solo le rotazioni, quando entra la libero e i cambi, ti propone chi batte e ti fa
          scegliere le giocatrici tra quelle in campo. Se non ti serve, salta questo passaggio.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {!cur ? (
          <p className="rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-muted-foreground">La partita è finita: la formazione non si può più cambiare.</p>
        ) : (
          <>
            <p className="text-[13px] font-semibold text-foreground/80" data-scout-lineup-scope>
              {fresh
                ? `Formazione di partenza del ${cur.n}° set.`
                : `${cur.n}° set già cominciato: quello che scrivi corregge chi è in campo adesso (le rotazioni fatte restano).`}
            </p>

            <DualLiveScoreCourt
              players={6}
              labelA="Noi"
              labelB="Loro"
              renderCellA={(position: CourtPosition) => (
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
              )}
              renderCellB={(position: CourtPosition) => (
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
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-border-subtle bg-surface p-3">
                <p className="text-[13px] font-bold text-primary">Noi</p>
                <div>
                  <Label htmlFor="scout-lineup-us-libero">Libero</Label>
                  <Select
                    id="scout-lineup-us-libero"
                    value={us.libero}
                    onChange={(e) => touch(setUs, { ...us, libero: e.target.value })}
                  >
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
                            const p = data.roster.us.find((x) => x.id === id);
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

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={confirm} data-scout-lineup-confirm>
                <Check className="h-4 w-4" />
                Conferma la formazione
              </Button>
              {savedHasPlayers && (
                <Button variant="outline" onClick={useSaved} data-scout-lineup-saved>
                  Usa la formazione salvata del {cur.n}° set
                </Button>
              )}
              {hasCourt && (
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
        )}
      </CardBody>
    </Card>
  );
}
