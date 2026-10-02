import type { Metadata } from "next";
import { format } from "date-fns";
import { CalendarX2, Plus, Trophy } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedLinks } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrainingList } from "./TrainingList";

export const metadata: Metadata = {
  title: "Elenco allenamenti",
};

export default async function TrainingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);
  const isMinivolley = team === "minivolley";
  const activeType: "all" | "allenamenti" | "tornei" =
    isMinivolley && (type === "allenamenti" || type === "tornei") ? type : "all";

  const repo = await getActiveRepo();
  const [allTrainings, occurrencePlans] = await Promise.all([
    repo.listTrainings({ team }),
    repo.listTrainingOccurrencePlans(),
  ]);
  const trainings = allTrainings.filter((t) => {
    if (activeType === "allenamenti") return !t.isTournament;
    if (activeType === "tornei") return t.isTournament;
    return true;
  });
  const todayStr = format(new Date(), "yyyy-MM-dd");
  // Un plain object, non una Map: attraversa il confine Server->Client
  // component verso TrainingList, e una Map non è serializzabile lì.
  const upcomingLinkedCountByRule: Record<string, number> = {};
  for (const o of occurrencePlans) {
    if (o.occurrenceDate < todayStr) continue;
    upcomingLinkedCountByRule[o.trainingRuleId] = (upcomingLinkedCountByRule[o.trainingRuleId] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/allenamenti", label: "Calendario" }}
        title="Elenco regole"
        description="Orari ricorrenti e singoli giorni: giorni della settimana, orario e luogo di ogni allenamento."
        actions={
          <>
            {isMinivolley && (
              <LinkButton href="/admin/allenamenti/nuovo?type=torneo" variant="outline">
                <Trophy className="h-4 w-4" />
                Nuovo torneo
              </LinkButton>
            )}
            <LinkButton href="/admin/allenamenti/nuovo">
              <Plus className="h-4 w-4" />
              Nuovo allenamento
            </LinkButton>
          </>
        }
      />

      {isMinivolley && (
        <SegmentedLinks
          className="mb-4"
          ariaLabel="Filtra per tipo"
          items={(["all", "allenamenti", "tornei"] as const).map((value) => ({
            href: value === "all" ? "/admin/allenamenti/elenco" : `/admin/allenamenti/elenco?type=${value}`,
            label: value === "all" ? "Tutti" : value === "allenamenti" ? "Allenamenti" : "Tornei",
            active: activeType === value,
          }))}
        />
      )}

      {trainings.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Nessun allenamento configurato"
          description="Creane uno per farlo comparire nel calendario pubblico."
        />
      ) : (
        <TrainingList trainings={trainings} upcomingLinkedCountByRule={upcomingLinkedCountByRule} />
      )}
    </div>
  );
}
