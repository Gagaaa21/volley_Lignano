"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff, RotateCcw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  deviceNotes,
  deviceSubscriptions,
  endpointService,
  endpointTail,
  PUSH_TEAMS,
  resetDevice,
  subscribeTeam,
  unsubscribeTeam,
} from "@/lib/pwa/teamPush";
import type { TrainingTeam } from "@/lib/types";
import { lastPushError, pushSupported, withPushDeps, type PushError } from "./browserPush";

/**
 * «Notifiche di questo dispositivo»: le notifiche di U14/U15 e quelle di Minivolley sono due cose distinte, e qui si vede
 * cosa riceve davvero questo dispositivo e lo si decide, squadra per squadra. Si legge lo stato vero dal browser (le
 * iscrizioni che ha) e da quello che il sito ne sa (con quale squadra le ha registrate): se non coincidono si segnala e si
 * rimette a posto. Vale per il dispositivo, o per l'app installata, da cui si apre la pagina.
 */

const TEAM_NAMES: Record<TrainingTeam, string> = { u14u15: "Under 14 e Under 15", minivolley: "Minivolley" };

type Permission = NotificationPermission | "unsupported";

interface TeamState {
  endpoint: string | null;
  /** Come l'ha registrata il sito: la squadra, null se non la conosce, undefined se non si è riusciti a chiederlo. */
  serverTeam: TrainingTeam | null | undefined;
}

interface Snapshot {
  permission: Permission;
  teams: Record<TrainingTeam, TeamState>;
  notes: ReturnType<typeof deviceNotes> | null;
  error: PushError | null;
}

const NONE: Record<TrainingTeam, TeamState> = {
  u14u15: { endpoint: null, serverTeam: undefined },
  minivolley: { endpoint: null, serverTeam: undefined },
};

async function fetchServerTeams(endpoints: string[]): Promise<Record<string, TrainingTeam | null> | null> {
  try {
    const response = await fetch("/api/push/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoints }),
    });
    if (!response.ok) return null;
    return ((await response.json()) as { teams?: Record<string, TrainingTeam | null> }).teams ?? null;
  } catch {
    return null;
  }
}

async function readDevice(pathname: string): Promise<Snapshot> {
  const permission: Permission = pushSupported() ? Notification.permission : "unsupported";
  if (permission === "unsupported") return { permission, teams: NONE, notes: null, error: lastPushError() };
  const found = await withPushDeps(pathname, async (deps) => ({ subs: await deviceSubscriptions(deps), notes: deviceNotes(deps) }));
  if (!found) return { permission, teams: NONE, notes: null, error: lastPushError() };
  const endpoints = PUSH_TEAMS.flatMap((team) => (found.subs[team] ? [found.subs[team].endpoint] : []));
  const labels = endpoints.length > 0 ? await fetchServerTeams(endpoints) : {};
  const teams = Object.fromEntries(
    PUSH_TEAMS.map((team) => {
      const endpoint = found.subs[team]?.endpoint ?? null;
      return [team, { endpoint, serverTeam: endpoint && labels ? (labels[endpoint] ?? null) : undefined }];
    }),
  ) as Record<TrainingTeam, TeamState>;
  return { permission, teams, notes: found.notes, error: lastPushError() };
}

/** Cosa non va in un'iscrizione che c'è, a parole; null se va bene (o non si sa). */
function problemOf(team: TrainingTeam, state: TeamState): string | null {
  if (!state.endpoint || state.serverTeam === undefined) return null;
  if (state.serverTeam === null) return "Il sito non la conosce: gli avvisi di questa squadra non arrivano.";
  if (state.serverTeam !== team) return `Il sito l'ha registrata come ${TEAM_NAMES[state.serverTeam]}: gli avvisi sbagliati arrivano qui.`;
  return null;
}

export function NotificationSettings({ team }: { team: TrainingTeam }) {
  const pathname = usePathname() ?? "/";
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setSnapshot(await readDevice(pathname));
  }, [pathname]);
  useEffect(() => {
    let cancelled = false;
    void readDevice(pathname).then((next) => {
      if (!cancelled) setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  /** Un'azione che cambia le iscrizioni: si aspetta, si dice com'è andata e si rilegge lo stato vero. */
  async function run(task: () => Promise<{ tone: "ok" | "error"; text: string }>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await task());
    } catch {
      setMessage({ tone: "error", text: "Qualcosa non ha funzionato: riprova tra poco." });
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  const failed = (what: string) => {
    const error = lastPushError();
    return { tone: "error" as const, text: `${what}${error ? ` (${error.message})` : ""}` };
  };

  async function enable(target: TrainingTeam) {
    await run(async () => {
      // Il permesso si chiede qui, dentro il tocco: iPhone e iPad lo vogliono così.
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return { tone: "error", text: "Senza il permesso del browser le notifiche non si possono attivare." };
      }
      const ok = await withPushDeps(pathname, (deps) => subscribeTeam(deps, target));
      return ok ? { tone: "ok", text: `Notifiche ${TEAM_NAMES[target]} attivate su questo dispositivo.` } : failed("Non sono riuscito ad attivarle");
    });
  }

  async function disable(target: TrainingTeam) {
    await run(async () => {
      await withPushDeps(pathname, (deps) => unsubscribeTeam(deps, target));
      return { tone: "ok", text: `Notifiche ${TEAM_NAMES[target]} disattivate su questo dispositivo.` };
    });
  }

  /** Toglie l'iscrizione e ne fa una nuova, registrata con la squadra giusta. */
  async function repair(target: TrainingTeam) {
    await run(async () => {
      const ok = await withPushDeps(pathname, async (deps) => {
        await unsubscribeTeam(deps, target);
        return subscribeTeam(deps, target);
      });
      return ok ? { tone: "ok", text: `Notifiche ${TEAM_NAMES[target]} rimesse a posto.` } : failed("Non sono riuscito a rimetterle a posto");
    });
  }

  async function reset() {
    await run(async () => {
      const removed = await withPushDeps(pathname, (deps) => resetDevice(deps));
      return removed === undefined
        ? failed("Non sono riuscito a toglierle")
        : { tone: "ok", text: "Notifiche tolte da questo dispositivo. Adesso attiva solo quelle che vuoi." };
    });
  }

  const order: TrainingTeam[] = team === "minivolley" ? ["minivolley", "u14u15"] : ["u14u15", "minivolley"];
  const permission = snapshot?.permission ?? null;
  const blocked = permission === "denied" || permission === "unsupported";

  return (
    <div className="space-y-4" data-notify-settings>
      {permission === "unsupported" && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground/80" data-notify-permission="unsupported">
          Questo browser non supporta le notifiche. Su iPhone e iPad funzionano solo dall&apos;app aggiunta alla schermata Home
          (Condividi › Aggiungi alla schermata Home): aprila da lì.
        </p>
      )}
      {permission === "denied" && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground/80" data-notify-permission="denied">
          Hai bloccato le notifiche per questo sito: per riattivarle cambia le impostazioni del browser o del telefono, poi
          torna qui.
        </p>
      )}

      {order.map((target) => {
        const state = snapshot?.teams[target] ?? NONE[target];
        const active = state.endpoint !== null;
        const problem = problemOf(target, state);
        return (
          <section
            key={target}
            className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"
            data-notify-team={target}
            data-notify-state={snapshot ? (active ? "active" : "inactive") : "loading"}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">{TEAM_NAMES[target]}</h2>
              {snapshot && <Badge tone={active ? "success" : "neutral"}>{active ? "Attive su questo dispositivo" : "Non attive"}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {target === "minivolley"
                ? "Avvisi quando allenamenti o tornei di Minivolley cambiano in calendario."
                : "Avvisi quando allenamenti o partite di U14 e U15 cambiano in calendario."}
            </p>
            {problem && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning" role="alert" data-notify-problem>
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{problem} Tocca «Rimetti a posto».</span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {snapshot && !active && (
                <Button size="sm" onClick={() => enable(target)} disabled={busy || blocked} data-notify-enable={target}>
                  <Bell className="h-4 w-4" />
                  Attiva
                </Button>
              )}
              {snapshot && active && (
                <Button size="sm" variant="outline" onClick={() => disable(target)} disabled={busy} data-notify-disable={target}>
                  <BellOff className="h-4 w-4" />
                  Disattiva
                </Button>
              )}
              {problem && (
                <Button size="sm" onClick={() => repair(target)} disabled={busy} data-notify-repair={target}>
                  <RotateCcw className="h-4 w-4" />
                  Rimetti a posto
                </Button>
              )}
            </div>
          </section>
        );
      })}

      {message && (
        <p
          role="status"
          data-notify-message={message.tone}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium",
            message.tone === "ok" ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          {message.text}
        </p>
      )}

      <section className="rounded-2xl border border-dashed border-border-strong bg-surface/60 p-4 sm:p-5">
        <h2 className="font-display text-base font-bold text-foreground">Le notifiche non tornano?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Se su questo dispositivo ti arrivano avvisi che non vuoi, o doppi, togli tutto e poi attiva solo le squadre che ti
          servono. Vale per questo dispositivo (o per questa app installata), non per gli altri.
        </p>
        <Button className="mt-3" size="sm" variant="outline" onClick={reset} disabled={busy || !snapshot} data-notify-reset>
          <RotateCcw className="h-4 w-4" />
          Togli tutte le notifiche da qui
        </Button>
      </section>

      <details className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground/80 sm:p-5" data-notify-details>
        <summary className="cursor-pointer font-semibold text-foreground">Dettagli tecnici</summary>
        <dl className="mt-3 space-y-1.5">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Permesso del browser:</dt>
            <dd>{permission === null ? "…" : permission}</dd>
          </div>
          {snapshot?.notes && (
            <>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">App sulla schermata Home di iPhone/iPad:</dt>
                <dd>{snapshot.notes.iosApp ? "sì" : "no"}</dd>
              </div>
              {snapshot.notes.iosApp && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Riconosciuta come app di:</dt>
                  <dd>{snapshot.notes.appTeam ? TEAM_NAMES[snapshot.notes.appTeam] : "non ancora"}</dd>
                </div>
              )}
            </>
          )}
          {PUSH_TEAMS.map((target) => {
            const state = snapshot?.teams[target];
            return (
              <div key={target} className="flex flex-wrap gap-2" data-notify-detail={target}>
                <dt className="text-muted-foreground">{TEAM_NAMES[target]}:</dt>
                <dd>
                  {state?.endpoint
                    ? `iscrizione su ${endpointService(state.endpoint)}, fine …${endpointTail(state.endpoint)}, registrata sul sito come ${
                        state.serverTeam === undefined ? "?" : state.serverTeam === null ? "nessuna" : TEAM_NAMES[state.serverTeam]
                      }`
                    : "nessuna iscrizione"}
                </dd>
              </div>
            );
          })}
          {snapshot?.error && (
            <div className="flex flex-wrap gap-2" data-notify-last-error>
              <dt className="text-muted-foreground">Ultimo problema:</dt>
              <dd>
                {new Date(snapshot.error.at).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{" "}
                · {snapshot.error.step}: {snapshot.error.message}
              </dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  );
}
