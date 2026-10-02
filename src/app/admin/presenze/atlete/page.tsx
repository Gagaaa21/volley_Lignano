import type { Metadata } from "next";
import { Download, ListPlus, Plus, Users } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AthleteList } from "./AthleteList";

export const metadata: Metadata = {
  title: "Atlete",
};

export default async function AthletesPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const repo = await getActiveRepo();
  const athletes = await repo.listAthletes({ team });

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/presenze", label: "Presenze" }}
        title="Atlete"
        description="L'anagrafica usata per registrare le presenze agli allenamenti."
        actions={
          <>
            <LinkButton href="/admin/presenze/atlete/elenco" variant="outline">
              <ListPlus className="h-4 w-4" />
              Aggiungi in elenco
            </LinkButton>
            <LinkButton href="/admin/presenze/atlete/nuova">
              <Plus className="h-4 w-4" />
              Nuova atleta
            </LinkButton>
          </>
        }
      />

      {athletes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessuna atleta ancora"
          description="Aggiungi la prima per iniziare a registrare le presenze."
        />
      ) : (
        <>
          <AthleteList athletes={athletes} team={team} />
          <div className="mt-8 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border pt-4">
            <span className="mr-2 text-[13px] font-semibold text-muted-foreground">Esporta CSV</span>
            <LinkButton href="/api/presenze/atlete/csv" variant="quiet" size="sm">
              <Download className="h-4 w-4" />
              Anagrafica
            </LinkButton>
            <LinkButton href="/api/presenze/riepilogo/csv" variant="quiet" size="sm">
              <Download className="h-4 w-4" />
              Riepilogo presenze
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
