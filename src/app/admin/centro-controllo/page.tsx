import type { Metadata } from "next";
import { Bell, Clock, Eye, KeyRound, ListChecks, Shield } from "lucide-react";
import { requireDev } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { matchTitle } from "@/lib/calendar";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { OccurrenceVisibilityToggle } from "./OccurrenceVisibilityToggle";
import { NotificationForm } from "./NotificationForm";
import { PermissionsMatrix } from "./PermissionsMatrix";

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

export default async function CentroControlloPage() {
  await requireDev();
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

  const adminIds = new Set(staff.filter((s) => s.role === "admin").map((s) => s.id));
  const adminSubscriberCount = pushSubscriptions.filter(
    (sub) => sub.staffId && adminIds.has(sub.staffId),
  ).length;
  const u14u15SubscriberCount = pushSubscriptions.filter((sub) => sub.team === "u14u15").length;
  const minivolleySubscriberCount = pushSubscriptions.filter((sub) => sub.team === "minivolley").length;

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
    const label = matchTitle(m);
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
  const matchLabelById = new Map(matches.map((m) => [m.id, matchTitle(m)] as const));
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
  const recentActivity = activity.slice(0, 20);

  // ---- Schede: visibilità pubblica centralizzata ----
  const trainingById = new Map(trainings.map((t) => [t.id, t] as const));
  const planById = new Map(plans.map((p) => [p.id, p] as const));
  const occurrenceRows = [...occurrencePlans].sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? 1 : -1));

  // ---- Permessi pagine: un account Admin per riga ----
  const adminRows = staff
    .filter((s) => s.role === "admin")
    .map((s) => ({
      id: s.id,
      fullName: s.fullName,
      username: s.username,
      allowedPages: s.allowedPages,
      allowedTeams: s.allowedTeams,
    }));

  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">
        <Shield className="h-3 w-3" />
        Solo Developer
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Centro di controllo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Notifiche manuali, visibilità pubblica delle schede e attività recenti, riservato al
        Developer. Per gli account staff vai alla sezione &quot;Staff&quot;.
      </p>

      {/* Notifica manuale */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Invia notifica manuale</h2>
            <p className="text-sm text-muted-foreground">
              Per avvisi occasionali che non corrispondono a una modifica del calendario, es.
              &quot;le convocazioni sono disponibili&quot;.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <NotificationForm
            u14u15Subscribers={u14u15SubscriberCount}
            minivolleySubscribers={minivolleySubscriberCount}
            adminSubscribers={adminSubscriberCount}
          />
        </CardBody>
      </Card>

      {/* Permessi pagine */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="icon-chip shrink-0">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Permessi pagine</h2>
            <p className="text-sm text-muted-foreground">
              Scegli quali sezioni dell&apos;area riservata e quali squadre (U14/U15, Minivolley) può
              gestire ogni account Admin. Un Developer vede sempre tutto.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <PermissionsMatrix admins={adminRows} />
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

      <p className="mt-3 flex items-center gap-1.5 text-xs text-foreground/40">
        <Clock className="h-3 w-3" />
        Pagina generata al caricamento: aggiorna per dati sempre aggiornati.
      </p>
    </div>
  );
}
