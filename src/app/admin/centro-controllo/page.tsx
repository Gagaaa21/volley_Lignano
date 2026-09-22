import type { Metadata } from "next";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Bell, Clock, Eye, FlaskConical, KeyRound, ListChecks, Shield, ShieldCheck, Users } from "lucide-react";
import { requireDev } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { OccurrenceVisibilityToggle } from "./OccurrenceVisibilityToggle";
import { NotificationForm } from "./NotificationForm";

export const metadata: Metadata = {
  title: "Centro di controllo",
};

interface ActivityEntry {
  type: string;
  label: string;
  by: string | null;
  at: string;
  kind: "creata" | "aggiornata";
}

function formatUnixSeconds(seconds: number): string {
  return format(new Date(seconds * 1000), "d MMM yyyy, HH:mm", { locale: it });
}

export default async function CentroControlloPage() {
  const session = await requireDev();
  const repo = await getRepo();

  const [staff, athletes, matches, trainings, blocks, plans, occurrencePlans, attendanceSessions, lineups, pushSubscriptions] =
    await Promise.all([
      repo.listStaff(),
      repo.listAthletes(),
      repo.listMatches(),
      repo.listTrainings(),
      repo.listTrainingBlocks(),
      repo.listTrainingPlans(),
      repo.listTrainingOccurrencePlans(),
      repo.listAttendanceSessions(),
      repo.listMatchLineups(),
      repo.listPushSubscriptions(),
    ]);

  const staffNameById = new Map(staff.map((s) => [s.id, s.fullName] as const));
  const byName = (id: string | null) => (id ? (staffNameById.get(id) ?? "Account rimosso") : null);

  // ---- Sessione corrente: iat/exp sono claim standard del JWT, presenti a
  // runtime ma non nel tipo SessionPayload (non servono altrove nel sito). ----
  const rawSession = session as typeof session & { iat?: number; exp?: number };

  // ---- Registro attività recenti: dai campi creazione/aggiornamento già
  // presenti su ogni tabella, raccolti qui in un'unica vista. Non è uno
  // storico completo di ogni modifica (richiederebbe un log dedicato): per
  // le modifiche successive alla creazione si sa quando, non sempre chi. ----
  const activity: ActivityEntry[] = [];
  for (const a of athletes) {
    activity.push({ type: "Atleta", label: a.fullName, by: byName(a.createdBy), at: a.createdAt, kind: "creata" });
    if (a.updatedAt !== a.createdAt)
      activity.push({ type: "Atleta", label: a.fullName, by: null, at: a.updatedAt, kind: "aggiornata" });
  }
  for (const m of matches) {
    const label = `vs ${m.opponent}`;
    activity.push({ type: "Partita", label, by: byName(m.createdBy), at: m.createdAt, kind: "creata" });
    if (m.updatedAt !== m.createdAt)
      activity.push({ type: "Partita", label, by: null, at: m.updatedAt, kind: "aggiornata" });
  }
  for (const t of trainings) {
    activity.push({ type: "Allenamento", label: t.title, by: byName(t.createdBy), at: t.createdAt, kind: "creata" });
    if (t.updatedAt !== t.createdAt)
      activity.push({ type: "Allenamento", label: t.title, by: null, at: t.updatedAt, kind: "aggiornata" });
  }
  for (const b of blocks) {
    activity.push({ type: "Blocco scheda", label: b.title, by: byName(b.createdBy), at: b.createdAt, kind: "creata" });
    if (b.updatedAt !== b.createdAt)
      activity.push({ type: "Blocco scheda", label: b.title, by: null, at: b.updatedAt, kind: "aggiornata" });
  }
  for (const p of plans) {
    activity.push({ type: "Scheda", label: p.title, by: byName(p.createdBy), at: p.createdAt, kind: "creata" });
    if (p.updatedAt !== p.createdAt)
      activity.push({ type: "Scheda", label: p.title, by: null, at: p.updatedAt, kind: "aggiornata" });
  }
  for (const s of attendanceSessions) {
    const label = `${s.title} · ${formatDateShort(s.sessionDate)}`;
    activity.push({ type: "Presenze", label, by: byName(s.createdBy), at: s.createdAt, kind: "creata" });
    if (s.updatedAt !== s.createdAt)
      activity.push({ type: "Presenze", label, by: null, at: s.updatedAt, kind: "aggiornata" });
  }
  for (const s of staff) {
    activity.push({ type: "Staff", label: s.fullName, by: byName(s.createdBy), at: s.createdAt, kind: "creata" });
  }
  const matchLabelById = new Map(matches.map((m) => [m.id, `vs ${m.opponent}`] as const));
  for (const l of lineups) {
    activity.push({
      type: "Formazioni",
      label: matchLabelById.get(l.matchId) ?? "Partita",
      by: byName(l.updatedBy),
      at: l.updatedAt,
      kind: "aggiornata",
    });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));
  const recentActivity = activity.slice(0, 30);

  // ---- Schede: visibilità pubblica centralizzata ----
  const trainingById = new Map(trainings.map((t) => [t.id, t] as const));
  const planById = new Map(plans.map((p) => [p.id, p] as const));
  const occurrenceRows = [...occurrencePlans].sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? 1 : -1));

  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow">
        <Shield className="h-3 w-3" />
        Solo Developer
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Centro di controllo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Account staff, sessione corrente, attività recenti, visibilità pubblica delle schede e
        notifiche manuali: tutto in un unico posto, riservato al Developer.
      </p>

      {/* Account staff */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Account staff</h2>
            <p className="text-sm text-muted-foreground">{staff.length} account attivi.</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Ruolo</th>
                  <th className="py-2 pr-4">Creato da</th>
                  <th className="py-2 pr-4">Creato il</th>
                  <th className="py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-border-subtle/60 last:border-0">
                    <td className="py-2 pr-4">
                      <p className="font-medium text-foreground">{s.fullName}</p>
                      <p className="text-xs text-foreground/50">@{s.username}</p>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          s.role === "dev" ? "bg-sand-100 text-sand-800" : "bg-primary/10 text-primary",
                        )}
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        {s.role === "dev" ? "Developer" : "Admin"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-foreground/70">{byName(s.createdBy) ?? "—"}</td>
                    <td className="py-2 pr-4 tabular-nums text-foreground/70">{formatDateTime(s.createdAt)}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.mustChangePassword && (
                          <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sand-800">
                            Password da cambiare
                          </span>
                        )}
                        {!s.hasSeenGuide && (
                          <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/50">
                            Guida non vista
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Sessione corrente */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Sessione corrente</h2>
            <p className="text-sm text-muted-foreground">La sessione con cui hai eseguito l&apos;accesso ora.</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <dt className="text-foreground/50">Account</dt>
              <dd className="font-medium text-foreground">
                {session.fullName} (@{session.username})
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <dt className="text-foreground/50">Ruolo</dt>
              <dd className="font-medium text-foreground">Developer</dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <dt className="text-foreground/50">Modalità prova</dt>
              <dd className="flex items-center gap-1 font-medium text-foreground">
                {session.testMode && <FlaskConical className="h-3.5 w-3.5 text-[var(--color-u15-strong)]" />}
                {session.testMode ? "Attiva" : "Non attiva"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <dt className="text-foreground/50">Accesso effettuato il</dt>
              <dd className="font-medium text-foreground">
                {rawSession.iat ? formatUnixSeconds(rawSession.iat) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start sm:col-span-2">
              <dt className="text-foreground/50">Sessione valida fino al</dt>
              <dd className="font-medium text-foreground">
                {rawSession.exp ? formatUnixSeconds(rawSession.exp) : "—"}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* Visibilità pubblica delle schede */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <Eye className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Visibilità pubblica delle schede
            </h2>
            <p className="text-sm text-muted-foreground">
              Tutte le schede collegate a un allenamento, in un unico elenco: cambia la visibilità
              senza aprire ogni singolo allenamento.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {occurrenceRows.length === 0 ? (
            <p className="text-sm text-foreground/50">Nessuna scheda collegata a un allenamento al momento.</p>
          ) : (
            <div className="space-y-2">
              {occurrenceRows.map((o) => {
                const training = trainingById.get(o.trainingRuleId);
                const plan = planById.get(o.planId);
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{plan?.title ?? "Scheda"}</p>
                      <p className="truncate text-xs text-foreground/50">
                        {training?.title ?? "Allenamento"} · {formatDateShort(o.occurrenceDate)}
                      </p>
                    </div>
                    <OccurrenceVisibilityToggle
                      ruleId={o.trainingRuleId}
                      date={o.occurrenceDate}
                      planId={o.planId}
                      isPublic={o.isPublic}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Attività recenti */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Attività recenti</h2>
            <p className="text-sm text-muted-foreground">
              Le {recentActivity.length} creazioni/modifiche più recenti su tutto il sito. Per le
              modifiche non è sempre noto chi le ha fatte: solo la creazione tiene traccia
              dell&apos;autore.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-foreground/50">Nessuna attività registrata.</p>
          ) : (
            <ul className="space-y-1.5">
              {recentActivity.map((entry, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border-subtle/60 pb-1.5 text-sm last:border-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground/55">
                      {entry.type}
                    </span>
                    <span className="truncate text-foreground/85">
                      {entry.label} <span className="text-foreground/45">· {entry.kind}</span>
                      {entry.by && <span className="text-foreground/45"> da {entry.by}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-foreground/40">
                    {formatDateTime(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Notifica manuale */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Invia notifica manuale</h2>
            <p className="text-sm text-muted-foreground">
              {pushSubscriptions.length > 0
                ? `${pushSubscriptions.length} dispositivi iscritti al momento.`
                : "Nessun dispositivo è iscritto alle notifiche al momento."}
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <NotificationForm />
        </CardBody>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-foreground/40">
        <Clock className="h-3 w-3" />
        Pagina generata al caricamento: aggiorna per dati sempre aggiornati.
      </p>
    </div>
  );
}
