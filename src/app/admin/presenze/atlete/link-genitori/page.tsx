import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical, Info, Link2, MessageCircle, RefreshCw } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { getOwnStaff, requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { categoryDotClass, categoryLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { isAvailabilityTableMissing } from "@/lib/availability/missing";
import { canUseFamilyLink } from "@/lib/availability/rules";
import { familyLinkMessage, whatsappShareUrl } from "@/lib/availability/share";
import { familyLinkPath } from "@/lib/availability/token";
import type { AthleteFamilyLink } from "@/lib/availability/types";
import { SITE_URL } from "@/lib/siteUrl";
import { whatsappPhone } from "@/lib/trips/phone";
import type { Athlete, Category } from "@/lib/types";
import type { AthleteContacts } from "@/lib/trips/types";
import { AvailabilitySetupNeeded } from "@/components/availability/AvailabilitySetupNeeded";
import { CopyLinkButton } from "@/components/availability/CopyLinkButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { Avatar, type AvatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { createFamilyLinkAction, createMissingFamilyLinksAction, rotateFamilyLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Link per i genitori",
};

const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

const GROUPS: { category: Category | null; tone: AvatarTone }[] = [
  { category: "U14", tone: "u14" },
  { category: "U15", tone: "u15" },
  { category: null, tone: "neutral" },
];

function FamilyRow({
  athlete,
  link,
  contacts,
  tone,
}: {
  athlete: Athlete;
  link: AthleteFamilyLink | undefined;
  contacts: AthleteContacts["contacts"];
  tone: AvatarTone;
}) {
  const path = link ? familyLinkPath(link.token) : null;
  const url = path ? `${SITE_URL}${path}` : null;
  const message = url ? familyLinkMessage(athlete.fullName, url) : null;
  // Chi ha il permesso Trasferte ha anche i numeri dei genitori: WhatsApp si apre già sulla loro chat. Gli altri scelgono la chat.
  const reachable = contacts.filter((contact) => whatsappPhone(contact.phone) !== null);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5 sm:px-5"
      data-family-row={athlete.id}
      data-family-path={path ?? undefined}
    >
      <Avatar name={athlete.fullName} tone={tone} />
      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate font-semibold text-foreground">{athlete.fullName}</p>
        <p className="text-[13px] text-muted-foreground">
          {link ? (link.rotatedAt ? "Link rigenerato: il vecchio non funziona più." : "Link pronto.") : "Ancora nessun link."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {url && message ? (
          <>
            <CopyLinkButton url={url} label={athlete.fullName} />
            {reachable.length > 0 ? (
              reachable.map((contact, index) => (
                <LinkButton
                  key={`${contact.phone}-${index}`}
                  href={whatsappShareUrl(contact.phone, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  variant="soft"
                  data-family-whatsapp
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp a {contact.relation || firstName(contact.name)}
                </LinkButton>
              ))
            ) : (
              <LinkButton href={whatsappShareUrl(null, message)} target="_blank" rel="noopener noreferrer" size="sm" variant="soft" data-family-whatsapp>
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </LinkButton>
            )}
            <form action={rotateFamilyLinkAction}>
              <input type="hidden" name="athleteId" value={athlete.id} />
              <ConfirmSubmitButton
                confirmMessage={`Rigenerare il link di ${athlete.fullName}? Quello vecchio smette di funzionare subito e il nuovo va mandato di nuovo.`}
                size="sm"
                variant="quiet"
                data-family-rotate
              >
                <RefreshCw className="h-4 w-4" />
                Rigenera
              </ConfirmSubmitButton>
            </form>
          </>
        ) : (
          <form action={createFamilyLinkAction}>
            <input type="hidden" name="athleteId" value={athlete.id} />
            <Button type="submit" size="sm" data-family-create>
              <Link2 className="h-4 w-4" />
              Crea link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function FamilyLinksPage() {
  const session = await requireStaff();
  if ((await resolveActiveTeam(session)) !== "u14u15") redirect("/admin/presenze/atlete");
  const repo = await getActiveRepo();
  const canSeeNumbers = session.role === "dev" || ((await getOwnStaff(session.sub))?.allowedPages.includes("trasferte") ?? false);

  let athletes: Athlete[];
  let links: AthleteFamilyLink[];
  let contacts: AthleteContacts[];
  try {
    [athletes, links, contacts] = await Promise.all([
      repo.listAthletes({ team: "u14u15" }),
      repo.listAthleteFamilyLinks(),
      canSeeNumbers ? repo.listAthleteContacts().catch(() => []) : Promise.resolve([]),
    ]);
  } catch (error) {
    if (!isAvailabilityTableMissing(error)) throw error;
    return (
      <div>
        <PageHeader back={{ href: "/admin/presenze/atlete", label: "Atlete" }} title="Link per i genitori" />
        <AvailabilitySetupNeeded isDev={session.role === "dev"} />
      </div>
    );
  }

  const active = athletes.filter((athlete) => canUseFamilyLink(athlete));
  const linkByAthlete = new Map(links.map((link) => [link.athleteId, link] as const));
  const contactsByAthlete = new Map(contacts.map((entry) => [entry.athleteId, entry.contacts] as const));
  const withLink = active.filter((athlete) => linkByAthlete.has(athlete.id)).length;
  const missing = active.length - withLink;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/presenze/atlete", label: "Atlete" }}
        title="Link per i genitori"
        description="Ogni atleta ha un link personale e segreto: lo mandi al genitore e da lì risponde «Ci sarà» o «Non ci sarà» a ogni partita. Niente account, niente elenco di nomi sul sito."
        actions={
          <>
            <Badge tone={missing === 0 && active.length > 0 ? "success" : "neutral"} data-family-count>
              {withLink} su {active.length} con un link
            </Badge>
            {missing > 0 && (
              <form action={createMissingFamilyLinksAction}>
                <Button type="submit" data-family-create-all>
                  <Link2 className="h-4 w-4" />
                  Crea i link mancanti ({missing})
                </Button>
              </form>
            )}
          </>
        }
      />

      {session.role === "dev" && session.testMode && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>Sei in modalità prova: i link che crei qui non funzionano per i genitori, che aprono sempre il sito vero.</span>
        </p>
      )}

      <p className="mb-6 flex items-start gap-2.5 rounded-xl bg-primary-soft/60 px-4 py-3 text-sm text-foreground/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Il link è solo di quella famiglia: se finisce dove non deve (per esempio in un gruppo), tocca <b>Rigenera</b> e il vecchio smette di funzionare. Le
          risposte le vedi nella scheda di ogni partita («Chi viene») e nelle convocazioni, e le puoi cambiare anche tu; non compaiono mai sul sito pubblico.
        </span>
      </p>

      {active.length === 0 ? (
        <EmptyState icon={Link2} title="Nessuna atleta attiva" description="Aggiungi le atlete di Under 14 e Under 15: poi qui prepari il link di ognuna." />
      ) : (
        <div className="space-y-8">
          {GROUPS.map(({ category, tone }) => {
            const group = active.filter((athlete) => athlete.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category ?? "senza"}>
                <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                    <span className={cn("h-2.5 w-2.5 rounded-full", categoryDotClass(category))} aria-hidden />
                    {categoryLabel(category)}
                  </h2>
                  <span className="text-[13px] text-muted-foreground">{group.length}</span>
                </div>
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {group.map((athlete) => (
                    <FamilyRow
                      key={athlete.id}
                      athlete={athlete}
                      link={linkByAthlete.get(athlete.id)}
                      contacts={contactsByAthlete.get(athlete.id) ?? []}
                      tone={tone}
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
