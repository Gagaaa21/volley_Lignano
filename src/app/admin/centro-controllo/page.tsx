import type { Metadata } from "next";
import { Bell, BellRing, Clock, KeyRound, ListChecks, Shield, Trophy } from "lucide-react";
import { requireDev } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_SHORT } from "@/lib/category";
import { formatDateShort, formatDateTime } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/button-variants";
import { PageHeader } from "@/components/ui/PageHeader";
import { endpointService, endpointTail } from "@/lib/pwa/teamPush";
import { NotificationForm } from "./NotificationForm";
import { NotificationPromptForm } from "./NotificationPromptForm";
import { NOTIFY_PROMPT_SETTING } from "@/lib/notifyPrompt";
import { FederationSourcesForm } from "./FederationSourcesForm";
import { PermissionsMatrix } from "./PermissionsMatrix";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_CENTRO_CONTROLLO_STEPS } from "@/components/tour/sectionSteps";

export const metadata: Metadata = {
  title: "Centro di controllo",
};

/** Data e ora in orario italiano (il server può girare su un altro fuso). */
function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ActivityEntry {
  type: string;
  label: string;
  by: string | null;
  at: string;
  kind: "creata" | "aggiornata";
}

// La lettura dei gironi dal portale (qualche tentativo ciascuno) può superare
// il tempo massimo di default delle funzioni, soprattutto sul piano gratuito di
// Vercel: 60 secondi bastano e restano entro il limite anche di quel piano.
export const maxDuration = 60;

export default async function CentroControlloPage() {
  await requireDev();
  const repo = await getRepo();

  const [
    staff,
    athletes,
    matches,
    trainings,
    plans,
    attendanceSessions,
    lineups,
    pushSubscriptions,
    notifyPromptAt,
    federation,
  ] = await Promise.all([
      repo.listStaff(),
      repo.listAthletes(),
      repo.listMatches(),
      repo.listTrainings(),
      repo.listTrainingPlans(),
      repo.listAttendanceSessions(),
      repo.listMatchLineups(),
      repo.listPushSubscriptions(),
      // Senza la tabella app_settings (SQL non ancora eseguito) si mostra solo «mai inviata».
      repo.getAppSetting(NOTIFY_PROMPT_SETTING).catch(() => null),
      // Se le tabelle non esistono ancora su Supabase la pagina deve restare
      // utilizzabile: si mostra solo un avviso al posto del modulo.
      Promise.all([repo.listFederationSources(), repo.listFederationSnapshots()]).then(
        ([sources, snapshots]) => ({ sources, snapshots }),
        () => null,
      ),
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
  // «U14 · vs Degano»: due partite di categorie diverse contro la stessa avversaria non si confondono nel registro.
  const matchLabel = (m: (typeof matches)[number]) => (m.category ? `${CATEGORY_SHORT[m.category]} · ${matchTitle(m)}` : matchTitle(m));
  for (const m of matches) {
    const label = matchLabel(m);
    activity.push({ type: "Partita", label, by: byName(m.createdBy), at: m.createdAt, kind: "creata" });
    if (m.updatedAt !== m.createdAt)
      activity.push({ type: "Partita", label, by: null, at: m.updatedAt, kind: "aggiornata" });
  }
  for (const t of trainings) {
    activity.push({ type: "Allenamento", label: t.title, by: byName(t.createdBy), at: t.createdAt, kind: "creata" });
    if (t.updatedAt !== t.createdAt)
      activity.push({ type: "Allenamento", label: t.title, by: null, at: t.updatedAt, kind: "aggiornata" });
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
  const matchLabelById = new Map(matches.map((m) => [m.id, matchLabel(m)] as const));
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
      <PageHeader
        eyebrow={
          <>
            <Shield className="h-3 w-3" />
            Solo Developer
          </>
        }
        title="Centro di controllo"
        description="Notifiche manuali, permessi e attività recenti. Gli account staff si gestiscono dalla sezione Staff."
        help={<SectionTour steps={SECTION_CENTRO_CONTROLLO_STEPS} />}
      />

      {/* La pagina è lunga: da qui si salta alla parte che serve. */}
      <nav aria-label="Vai a" className="-mt-3 mb-6 flex flex-wrap gap-2" data-cc-nav>
        {[
          { id: "notifiche", label: "Notifiche", icon: Bell },
          { id: "permessi", label: "Permessi", icon: KeyRound },
          { id: "classifiche", label: "Classifiche", icon: Trophy },
          { id: "attivita", label: "Attività", icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Icon className="h-4 w-4" />
            {label}
          </a>
        ))}
      </nav>

      {/* Notifica manuale */}
      <Card id="notifiche" className="scroll-mt-24" data-tour="section-cc-notification">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Invia notifica manuale</h2>
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

      {/* Richiesta di attivazione notifiche */}
      <Card className="mt-5">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Chiedi di attivare le notifiche</h2>
            <p className="text-sm text-muted-foreground">
              Fa riapparire il messaggio &quot;Attiva le notifiche&quot; a chiunque apra il sito e non le abbia ancora
              attivate, anche se l&apos;aveva chiuso da poco. Chi le ha già attivate, o le ha bloccate dal browser, non
              vede niente.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <p className="mb-4 text-sm text-foreground/80" data-notify-prompt-last>
            {/* Un dispositivo ha una iscrizione per squadra (U14/U15 e Minivolley sono distinte): si contano le iscrizioni. */}
            {pushSubscriptions.length === 1
              ? "1 iscrizione alle notifiche"
              : `${pushSubscriptions.length} iscrizioni alle notifiche`}{" "}
            (U14/U15 {u14u15SubscriberCount}, Minivolley {minivolleySubscriberCount}): un dispositivo può avere quelle di tutte e due le squadre.{" "}
            {notifyPromptAt
              ? `Ultima richiesta inviata il ${formatMoment(notifyPromptAt)}.`
              : "Nessuna richiesta inviata finora."}
          </p>
          <NotificationPromptForm />
        </CardBody>
      </Card>

      {/* Le iscrizioni, una per una: per accorgersi di quelle doppie o con la squadra sbagliata */}
      <Card className="mt-5">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Iscrizioni alle notifiche, una per una</h2>
            <p className="text-sm text-muted-foreground">
              Una riga per ogni iscrizione. Un dispositivo può averne una per squadra; due della stessa squadra sullo stesso
              dispositivo sono doppie. Per sistemare un dispositivo apri «Notifiche di questo dispositivo» in fondo al sito
              pubblico (dall&apos;app interessata): la fine dell&apos;indirizzo è la stessa che vedi lì, in «Dettagli tecnici».
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <details data-notify-rows>
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Mostra le {pushSubscriptions.length} {pushSubscriptions.length === 1 ? "iscrizione" : "iscrizioni"}
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Squadra</th>
                    <th className="py-1.5 pr-3 font-semibold">Account</th>
                    <th className="py-1.5 pr-3 font-semibold">Servizio</th>
                    <th className="py-1.5 pr-3 font-semibold">Registrata</th>
                    <th className="py-1.5 font-semibold">Fine indirizzo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...pushSubscriptions]
                    .sort((a, b) => a.team.localeCompare(b.team) || b.createdAt.localeCompare(a.createdAt))
                    .map((sub) => (
                      <tr key={sub.id} data-notify-row={sub.team}>
                        <td className="py-1.5 pr-3">{sub.team === "minivolley" ? "Minivolley" : "U14/U15"}</td>
                        <td className="py-1.5 pr-3">{byName(sub.staffId) ?? "anonimo"}</td>
                        <td className="py-1.5 pr-3">{endpointService(sub.endpoint)}</td>
                        <td className="py-1.5 pr-3">{formatMoment(sub.createdAt)}</td>
                        <td className="py-1.5 font-mono text-xs">…{endpointTail(sub.endpoint)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardBody>
      </Card>

      {/* Permessi pagine */}
      <Card id="permessi" className="mt-5 scroll-mt-24" data-tour="section-cc-permissions">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Permessi pagine</h2>
            <p className="text-sm text-muted-foreground">
              Scegli quali sezioni dell&apos;area tecnici e quali squadre (U14/U15, Minivolley) può
              gestire ogni account Admin. Un Developer vede sempre tutto.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <PermissionsMatrix admins={adminRows} />
        </CardBody>
      </Card>

      {/* Classifiche e risultati ufficiali */}
      <Card id="classifiche" className="mt-5 scroll-mt-24" data-tour="section-cc-federation">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Classifiche e risultati ufficiali</h2>
            <p className="text-sm text-muted-foreground">
              Da dove il sito legge il girone di ogni categoria sul portale della federazione. Con l&apos;indirizzo
              impostato compaiono la classifica pubblica e, nelle Partite, i risultati da confermare.
            </p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {federation ? (
            <FederationSourcesForm sources={federation.sources} snapshots={federation.snapshots} />
          ) : (
            <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
              Mancano le tabelle su Supabase: esegui l&apos;SQL della sezione «Risultati e classifiche ufficiali» di{" "}
              <code>supabase/schema.sql</code> (SQL Editor) e ricarica la pagina.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Attività recenti */}
      <Card id="attivita" className="mt-5 scroll-mt-24" data-tour="section-cc-activity">
        <CardHeader className="flex flex-row items-start gap-3.5">
          <span className="icon-chip shrink-0">
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Attività recenti</h2>
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
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {recentActivity.map((entry, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
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
