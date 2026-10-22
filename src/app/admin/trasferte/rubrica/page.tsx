import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { parseCategoryFilter } from "@/lib/category";
import { isTripTableMissing } from "@/lib/trips/missing";
import type { AthleteContact, AthleteContacts } from "@/lib/trips/types";
import type { Athlete } from "@/lib/types";
import { requireStaffPage } from "@/lib/auth/guard";
import { CategoryFilterLinks } from "@/components/admin/CategoryFilterLinks";
import { ContactLinks } from "@/components/trips/ContactLinks";
import { ContactsForm } from "@/components/trips/ContactsForm";
import { TripsSetupNeeded } from "@/components/trips/TripsSetupNeeded";
import { Badge } from "@/components/ui/Badge";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Rubrica genitori",
};

export default async function RubricaPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const session = await requireStaffPage("trasferte");
  const { cat } = await searchParams;
  const category = parseCategoryFilter(cat);

  const repo = await getActiveRepo();
  let athletes: Athlete[];
  let rubrica: AthleteContacts[];
  try {
    [athletes, rubrica] = await Promise.all([repo.listAthletes({ team: "u14u15" }), repo.listAthleteContacts()]);
  } catch (error) {
    if (!isTripTableMissing(error)) throw error;
    return (
      <div>
        <PageHeader back={{ href: "/admin/trasferte", label: "Trasferte" }} title="Rubrica genitori" />
        <TripsSetupNeeded isDev={session.role === "dev"} />
      </div>
    );
  }

  const contactsByAthlete = new Map<string, AthleteContact[]>(rubrica.map((entry) => [entry.athleteId, entry.contacts]));
  const active = athletes
    .filter((a) => a.isActive)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "it"));
  const shown = active.filter((a) => category === "all" || a.category === category);
  const withNumbers = active.filter((a) => (contactsByAthlete.get(a.id)?.length ?? 0) > 0).length;

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/trasferte", label: "Trasferte" }}
        title="Rubrica genitori"
        description="Chi chiamare per ogni atleta: nome, chi è e numero. Si scrivono una volta e compaiono in ogni trasferta. Restano in questa sezione riservata."
        actions={
          <Badge tone={withNumbers === active.length && active.length > 0 ? "success" : "neutral"} data-rubrica-count>
            {withNumbers} su {active.length} atlete con un numero
          </Badge>
        }
      />

      <CategoryFilterLinks path="/admin/trasferte/rubrica" active={category} className="mb-6" />

      {shown.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Nessuna atleta in elenco"
          description="Le atlete si aggiungono da Presenze → Atlete: appena ci sono compaiono qui, pronte per i numeri."
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {shown.map((athlete) => {
            const contacts = contactsByAthlete.get(athlete.id) ?? [];
            return (
              <div key={athlete.id} className="px-4 py-3.5 sm:px-5" data-rubrica-athlete={athlete.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    {athlete.fullName}
                    <CategoryTag category={athlete.category} />
                  </p>
                  {contacts.length === 0 && <span className="text-xs font-semibold text-muted-foreground">Nessun numero</span>}
                </div>
                <ContactLinks contacts={contacts} />
                <details className="mt-3 rounded-xl border border-border bg-surface px-4 py-3" data-rubrica-edit={athlete.id}>
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    {contacts.length === 0 ? "Aggiungi i numeri" : "Modifica i numeri"}
                  </summary>
                  <div className="mt-4">
                    <ContactsForm athleteId={athlete.id} contacts={contacts} />
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
