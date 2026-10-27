import type { Metadata } from "next";
import {
  CalendarClock,
  CalendarPlus,
  FlaskConical,
  ImageIcon,
  Info,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaffPage } from "@/lib/auth/guard";
import { cn } from "@/lib/cn";
import { answerWhen } from "@/lib/availability/format";
import { missingAvailabilityTables } from "@/lib/availability/health";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { byPhrase } from "@/lib/availability/reporting";
import { canUseFamilyLink, staffNamesById } from "@/lib/availability/rules";
import { whatsappShareUrl } from "@/lib/availability/share";
import { familyLinkPath } from "@/lib/availability/token";
import type { AthleteFamilyLink } from "@/lib/availability/types";
import {
  certificateStatus,
  compareUrgency,
  parentReminder,
  statusLabel,
  type CertificateStatus,
  type MedicalCertificate,
} from "@/lib/medical/certificate";
import { loadCertificates } from "@/lib/medical/load";
import { SITE_URL } from "@/lib/siteUrl";
import { todayIso } from "@/lib/today";
import { whatsappPhone } from "@/lib/trips/phone";
import type { AthleteContacts } from "@/lib/trips/types";
import type { Athlete } from "@/lib/types";
import { AvailabilityDatabaseNotice } from "@/components/availability/AvailabilityDatabaseNotice";
import { EmptyValidityBar, ValidityBar } from "@/components/medical/ValidityBar";
import { Avatar, type AvatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { CertificateEditor } from "./CertificateEditor";

export const metadata: Metadata = {
  title: "Certificati medici",
};

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

const AVATAR_TONE: Record<string, AvatarTone> = { U14: "u14", U15: "u15" };

interface Entry {
  athlete: Athlete;
  certificate: MedicalCertificate | null;
  status: CertificateStatus;
}

type GroupKey = "attention" | "missing" | "valid";

const GROUPS: {
  key: GroupKey;
  anchor: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
  kinds: CertificateStatus["kind"][];
}[] = [
  {
    key: "attention",
    anchor: "da-rinnovare",
    title: "Da rinnovare",
    description: "Scaduti, o in scadenza entro un mese: avvisa il genitore.",
    icon: TriangleAlert,
    iconClass: "bg-destructive/10 text-destructive",
    kinds: ["expired", "expiring"],
  },
  {
    key: "missing",
    anchor: "senza-data",
    title: "Senza data",
    description: "Il genitore non ha ancora scritto il giorno della visita: finché manca, il certificato non risulta valido.",
    icon: CalendarPlus,
    iconClass: "bg-warning-soft text-warning",
    kinds: ["missing"],
  },
  {
    key: "valid",
    anchor: "in-regola",
    title: "In regola",
    description: "Validi per più di un mese.",
    icon: ShieldCheck,
    iconClass: "bg-success-soft text-success",
    kinds: ["valid"],
  },
];

/**
 * I certificati medici delle atlete di U14/U15 (permesso «Certificati medici», a sé come le Trasferte): per ognuna se è valido, con
 * il giorno della visita che ha scritto il genitore dal suo link personale (o lo staff, da qui) e la barra dell'anno di validità (la
 * scadenza la calcola il sito, un anno dopo). Un mese prima della scadenza diventa rosso e va in cima, con il messaggio già pronto
 * per avvisare il genitore. Il documento non si carica mai: solo la data.
 */
export default async function CertificatiPage() {
  const session = await requireStaffPage("certificati");
  const repo = await getActiveRepo();
  const today = todayIso();
  // Chi ha il permesso Trasferte ha anche i numeri dei genitori: WhatsApp si apre già sulla loro chat. Gli altri scelgono la chat.
  const canSeeNumbers = session.role === "dev" || ((await getOwnStaff(session.sub))?.allowedPages.includes("trasferte") ?? false);

  const [athletes, certificates, links, contacts, staff, missingTables] = await Promise.all([
    repo.listAthletes({ team: "u14u15" }),
    loadCertificates(repo),
    repo.listAthleteFamilyLinks().catch((error: unknown) => {
      if (isAvailabilityTableMissing(error)) return [] as AthleteFamilyLink[];
      throw error;
    }),
    canSeeNumbers ? repo.listAthleteContacts().catch((): AthleteContacts[] => []) : Promise.resolve<AthleteContacts[]>([]),
    repo.listStaff(),
    missingAvailabilityTables(repo),
  ]);
  // Ai certificati servono le impostazioni (dove sta la data) e i link dei genitori (da dove la scrivono); le assenze no.
  const missing = missingTables.filter((table) => table !== "match_availability");

  const staffNames = staffNamesById(staff);
  const linkByAthlete = new Map(links.map((link) => [link.athleteId, link] as const));
  const contactsByAthlete = new Map(contacts.map((entry) => [entry.athleteId, entry.contacts] as const));
  const entries: Entry[] = athletes
    .filter((athlete) => canUseFamilyLink(athlete))
    .map((athlete) => {
      const certificate = certificates?.get(athlete.id) ?? null;
      return { athlete, certificate, status: certificateStatus(certificate, today) };
    })
    .sort((a, b) => compareUrgency(a.status, b.status) || a.athlete.fullName.localeCompare(b.athlete.fullName, "it"));

  const count = (kind: CertificateStatus["kind"]) => entries.filter((entry) => entry.status.kind === kind).length;
  const expired = count("expired");
  const expiring = count("expiring");
  const without = count("missing");
  const valid = count("valid");

  return (
    <div>
      <PageHeader
        title="Certificati medici"
        description="Per ogni atleta se il certificato medico è valido. Il genitore, dal suo link personale, sceglie il giorno della visita e carica una foto del certificato; il sito calcola la scadenza, un anno dopo, e un mese prima diventa rosso, così lo avvisi in tempo."
      />

      <AvailabilityDatabaseNotice
        missing={missing}
        isDev={session.role === "dev"}
        effect="Finché non c'è, la data dei certificati non si può scrivere."
        othersEffect="Finché non c'è, la data dei certificati non si può scrivere."
      />

      {session.role === "dev" && session.testMode && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>Sei in modalità prova: le date che scrivi qui restano nella prova, e quelle nuove dei genitori arrivano solo nel sito vero.</span>
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-certificate-summary>
        <StatTile
          href="#da-rinnovare"
          label="Scaduti"
          value={expired}
          icon={ShieldAlert}
          tone={expired > 0 ? "danger" : "primary"}
          className={cn(expired > 0 && "border-destructive/40 bg-destructive/[0.04]")}
        />
        <StatTile
          href="#da-rinnovare"
          label="In scadenza entro un mese"
          value={expiring}
          icon={CalendarClock}
          tone={expiring > 0 ? "danger" : "primary"}
          className={cn(expiring > 0 && "border-destructive/40 bg-destructive/[0.04]")}
        />
        <StatTile href="#senza-data" label="Senza data" value={without} icon={CalendarPlus} tone={without > 0 ? "warning" : "primary"} />
        <StatTile href="#in-regola" label="Validi" value={valid} icon={ShieldCheck} tone="success" />
      </div>

      <p className="mb-8 flex items-start gap-2.5 rounded-xl bg-primary-soft/60 px-4 py-3 text-sm leading-relaxed text-foreground/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Il link del genitore è lo stesso delle assenze (lo prepari in <b>Assenze → Link per i genitori</b>). <b>Avvisa il genitore</b> apre WhatsApp con
          il messaggio già scritto e il link. <b>Vedi la foto</b> apre la foto del certificato: la vede solo chi ha questo permesso, mai il sito
          pubblico. Data e foto le puoi mettere o correggere anche tu: si vede chi le ha scritte.
        </span>
      </p>

      {entries.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Nessuna atleta attiva" description="Aggiungi le atlete di Under 14 e Under 15: poi qui trovi i loro certificati." />
      ) : (
        <div className="space-y-10">
          {GROUPS.map((group) => {
            const rows = entries.filter((entry) => group.kinds.includes(entry.status.kind));
            if (rows.length === 0) return null;
            const Icon = group.icon;
            return (
              <section key={group.key} id={group.anchor} className="scroll-mt-24" data-certificate-group={group.key}>
                <div className="mb-3.5 flex items-start gap-3 px-1">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", group.iconClass)}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      className={cn(
                        "flex items-baseline gap-2 font-display text-lg font-bold leading-tight",
                        group.key === "attention" ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {group.title}
                      <span className="tabular text-[13px] font-semibold text-muted-foreground">{rows.length}</span>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "divide-y overflow-hidden rounded-2xl border bg-card shadow-card",
                    group.key === "attention" ? "divide-destructive/15 border-destructive/40" : "divide-border border-border",
                  )}
                >
                  {rows.map((entry) => (
                    <CertificateRow
                      key={entry.athlete.id}
                      entry={entry}
                      today={today}
                      link={linkByAthlete.get(entry.athlete.id) ?? null}
                      contacts={contactsByAthlete.get(entry.athlete.id) ?? []}
                      author={
                        entry.certificate
                          ? entry.certificate.by === "parent"
                            ? "dal genitore"
                            : byPhrase(entry.certificate.updatedBy ? staffNames.get(entry.certificate.updatedBy) : null)
                          : null
                      }
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CertificateRow({
  entry,
  today,
  link,
  contacts,
  author,
}: {
  entry: Entry;
  today: string;
  link: AthleteFamilyLink | null;
  contacts: AthleteContacts["contacts"];
  /** «dal genitore» / «da Gaga». */
  author: string | null;
}) {
  const { athlete, certificate, status } = entry;
  const label = statusLabel(status);
  const red = label.tone === "danger";
  // Il link apre già la scheda del certificato (e non quella delle assenze).
  const url = link ? `${SITE_URL}${familyLinkPath(link.token, "certificato")}` : null;
  const photo = certificate?.photo ?? null;
  const reminder = parentReminder(athlete.fullName, status, url, photo !== null);
  // In regola ma senza foto: il messaggio chiede solo quella.
  const remindLabel = status.kind === "valid" ? "Chiedi la foto" : null;
  const reachable = contacts.filter((contact) => whatsappPhone(contact.phone) !== null);

  return (
    <div
      className={cn("relative px-4 py-4 sm:px-5", red && "bg-destructive/[0.035]")}
      data-certificate-row={athlete.id}
      data-certificate-status={status.kind}
    >
      {red && <span className="absolute inset-y-0 left-0 w-1 bg-destructive" aria-hidden />}
      {/* Telefono: nome e stato sulla stessa riga, sotto la barra. Schermo largo: nome, barra e stato in tre colonne. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_9.5rem] lg:gap-x-8">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
          <Avatar name={athlete.fullName} tone={(athlete.category && AVATAR_TONE[athlete.category]) || "neutral"} />
          <div className="min-w-0">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-foreground">
              <span className="break-words">{athlete.fullName}</span>
              <CategoryTag category={athlete.category} />
            </p>
            {certificate && (
              <p className="text-[12px] text-muted-foreground" data-certificate-author>
                Data scritta {author} · {answerWhen(certificate.updatedAt)}
              </p>
            )}
            {certificate && (
              <p
                className={cn("flex items-center gap-1 text-[12px] font-semibold", photo ? "text-success" : "text-warning")}
                data-certificate-photo={photo ? "yes" : "no"}
              >
                <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {photo ? `Foto caricata ${photo.by === "parent" ? "dal genitore" : "dallo staff"} · ${answerWhen(photo.uploadedAt)}` : "Senza foto"}
              </p>
            )}
          </div>
        </div>

        <div className="col-span-2 row-start-2 min-w-0 sm:pl-[3.25rem] lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:pl-0">
          {certificate && status.kind !== "missing" ? (
            <ValidityBar issuedOn={certificate.issuedOn} validUntil={certificate.validUntil} today={today} kind={status.kind} />
          ) : (
            <EmptyValidityBar />
          )}
        </div>

        <div className="col-start-2 row-start-1 flex flex-col items-end gap-1 text-right lg:col-start-3">
          <Badge tone={label.tone} className={cn("px-2.5", red && "bg-destructive text-destructive-foreground")} data-certificate-badge>
            {label.badge}
          </Badge>
        </div>
      </div>

      <p
        className={cn("mt-3 text-[13px] sm:pl-[3.25rem]", red ? "font-semibold text-destructive" : "text-foreground/70")}
        data-certificate-detail
      >
        {/* In regola la scadenza è già sotto la barra: qui quanto manca. */}
        {status.kind === "valid" ? `Ancora ${status.daysLeft} giorni di validità.` : label.detail}
      </p>

      <div className="mt-3 sm:pl-[3.25rem]">
        <CertificateEditor
          athleteId={athlete.id}
          athleteName={athlete.fullName}
          issuedOn={certificate?.issuedOn ?? null}
          photo={photo}
          today={today}
        >
          {photo && (
            <LinkButton
              href={`/api/certificati/${athlete.id}/foto`}
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              size="sm"
              variant="outline"
              data-certificate-photo-link
            >
              <ImageIcon className="h-4 w-4" />
              Vedi la foto
            </LinkButton>
          )}
          {reminder &&
            (reachable.length > 0 ? (
              reachable.map((contact, index) => (
                <LinkButton
                  key={`${contact.phone}-${index}`}
                  href={whatsappShareUrl(contact.phone, reminder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  variant={red ? "danger" : "soft"}
                  data-certificate-remind
                >
                  <MessageCircle className="h-4 w-4" />
                  {remindLabel ? "Chiedi la foto a" : "Avvisa"} {contact.relation || firstName(contact.name)}
                </LinkButton>
              ))
            ) : (
              <LinkButton
                href={whatsappShareUrl(null, reminder)}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant={red ? "danger" : "soft"}
                data-certificate-remind
              >
                <MessageCircle className="h-4 w-4" />
                {remindLabel ?? "Avvisa il genitore"}
              </LinkButton>
            ))}
          {reminder && (
            <CopyTextButton
              text={reminder}
              variant="quiet"
              ariaLabel={`Copia il messaggio per il genitore di ${athlete.fullName}`}
              data-certificate-copy
            >
              Copia
            </CopyTextButton>
          )}
        </CertificateEditor>
        {reminder && !link && (
          <p className="mt-2 text-[12px] text-muted-foreground" data-certificate-no-link>
            Non ha ancora il link personale: nel messaggio non c&apos;è il link.
          </p>
        )}
      </div>
    </div>
  );
}
