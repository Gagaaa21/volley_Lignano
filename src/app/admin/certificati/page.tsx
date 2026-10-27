import type { Metadata } from "next";
import { FlaskConical, Info, MessageCircle, Stethoscope } from "lucide-react";
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
  dayLabel,
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
import { Avatar, type AvatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { CopyTextButton } from "@/components/ui/CopyTextButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
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

const GROUPS: { key: string; title: string; description: string; kinds: CertificateStatus["kind"][] }[] = [
  {
    key: "attention",
    title: "Da rinnovare",
    description: "Scaduti o in scadenza entro un mese: avvisa il genitore.",
    kinds: ["expired", "expiring"],
  },
  {
    key: "missing",
    title: "Senza date",
    description: "Il genitore non le ha ancora scritte: senza date il certificato non risulta valido.",
    kinds: ["missing"],
  },
  { key: "valid", title: "In regola", description: "Validi per più di un mese.", kinds: ["valid"] },
];

/**
 * I certificati medici delle atlete di U14/U15 (permesso «Certificati medici», a sé come le Trasferte): per ognuna se è valido,
 * con le due date che ha scritto il genitore dal suo link personale (o lo staff, da qui). Un mese prima della scadenza diventa
 * rosso e va in cima, con il messaggio già pronto per avvisare il genitore. Il documento non si carica mai: solo le date.
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
  // Ai certificati servono le impostazioni (dove stanno le date) e i link dei genitori (da dove le scrivono); le assenze no.
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
        description="Per ogni atleta se il certificato medico è valido. Il genitore scrive dal suo link personale il giorno della visita e fino a quando vale (il certificato non si manda); un mese prima della scadenza diventa rosso, così lo avvisi in tempo."
      />

      <AvailabilityDatabaseNotice
        missing={missing}
        isDev={session.role === "dev"}
        effect="Finché non c'è, le date dei certificati non si possono scrivere."
        othersEffect="Finché non c'è, le date dei certificati non si possono scrivere."
      />

      {session.role === "dev" && session.testMode && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>Sei in modalità prova: le date che scrivi qui restano nella prova, e quelle nuove dei genitori arrivano solo nel sito vero.</span>
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2" data-certificate-summary>
        <Badge tone={expired > 0 ? "danger" : "neutral"} data-certificate-count="expired">
          {expired === 1 ? "1 scaduto" : `${expired} scaduti`}
        </Badge>
        <Badge tone={expiring > 0 ? "danger" : "neutral"} data-certificate-count="expiring">
          {expiring} in scadenza
        </Badge>
        <Badge tone={without > 0 ? "warning" : "neutral"} data-certificate-count="missing">
          {without} senza date
        </Badge>
        <Badge tone={valid > 0 ? "success" : "neutral"} data-certificate-count="valid">
          {valid === 1 ? "1 valido" : `${valid} validi`}
        </Badge>
      </div>

      <p className="mb-6 flex items-start gap-2.5 rounded-xl bg-primary-soft/60 px-4 py-3 text-sm text-foreground/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Il link è lo stesso delle assenze (lo prepari in <b>Assenze → Link per i genitori</b>). Con <b>Avvisa il genitore</b> parte un messaggio
          WhatsApp già scritto, con il link. Le date le puoi scrivere o correggere anche tu: si vede chi le ha scritte.
        </span>
      </p>

      {entries.length === 0 ? (
        <EmptyState icon={Stethoscope} title="Nessuna atleta attiva" description="Aggiungi le atlete di Under 14 e Under 15: poi qui trovi i loro certificati." />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const rows = entries.filter((entry) => group.kinds.includes(entry.status.kind));
            if (rows.length === 0) return null;
            return (
              <section key={group.key} data-certificate-group={group.key}>
                <div className="mb-3 px-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2
                      className={cn(
                        "font-display text-lg font-bold",
                        group.key === "attention" ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {group.title}
                    </h2>
                    <span className="text-[13px] text-muted-foreground">{rows.length}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">{group.description}</p>
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
  const url = link ? `${SITE_URL}${familyLinkPath(link.token)}#certificato` : null;
  const reminder = parentReminder(athlete.fullName, status, url);
  const reachable = contacts.filter((contact) => whatsappPhone(contact.phone) !== null);

  return (
    <div className={cn("px-4 py-3.5 sm:px-5", red && "bg-destructive/[0.04]")} data-certificate-row={athlete.id} data-certificate-status={status.kind}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Avatar name={athlete.fullName} tone={(athlete.category && AVATAR_TONE[athlete.category]) || "neutral"} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-foreground">
            <span className="truncate">{athlete.fullName}</span>
            <CategoryTag category={athlete.category} />
          </p>
          <p className={cn("text-[13px]", red ? "font-semibold text-destructive" : "text-foreground/75")} data-certificate-detail>
            {label.detail}
          </p>
          {certificate && (
            <p className="text-[12px] text-muted-foreground" data-certificate-author>
              Visita del {dayLabel(certificate.issuedOn)} · date scritte {author} · {answerWhen(certificate.updatedAt)}
            </p>
          )}
        </div>
        <Badge tone={label.tone} className={cn(red && "bg-destructive text-destructive-foreground")} data-certificate-badge>
          {label.badge}
        </Badge>
      </div>

      <CertificateEditor
        athleteId={athlete.id}
        athleteName={athlete.fullName}
        issuedOn={certificate?.issuedOn ?? null}
        validUntil={certificate?.validUntil ?? null}
        today={today}
      >
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
                Avvisa {contact.relation || firstName(contact.name)}
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
              Avvisa il genitore
            </LinkButton>
          ))}
        {reminder && (
          <CopyTextButton text={reminder} variant="quiet" ariaLabel={`Copia il messaggio per il genitore di ${athlete.fullName}`} data-certificate-copy>
            Copia
          </CopyTextButton>
        )}
        {reminder && !link && (
          <span className="text-[12px] text-muted-foreground" data-certificate-no-link>
            Senza link personale: il messaggio chiede le date a voce.
          </span>
        )}
      </CertificateEditor>
    </div>
  );
}
