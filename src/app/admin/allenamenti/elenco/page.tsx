import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Plus, Trophy } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { cn } from "@/lib/cn";
import { LinkButton } from "@/components/ui/LinkButton";
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
      <LinkButton href="/admin/allenamenti" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna al calendario
      </LinkButton>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Elenco regole</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Orari ricorrenti e singoli giorni: giorni della settimana, orario e luogo di ogni allenamento.
          </p>
        </div>
        {isMinivolley ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <LinkButton href="/admin/allenamenti/nuovo">
              <Plus className="h-4 w-4" />
              Nuovo allenamento
            </LinkButton>
            <LinkButton href="/admin/allenamenti/nuovo?type=torneo" variant="outline">
              <Trophy className="h-4 w-4" />
              Nuovo torneo
            </LinkButton>
          </div>
        ) : (
          <LinkButton href="/admin/allenamenti/nuovo">
            <Plus className="h-4 w-4" />
            Nuovo allenamento
          </LinkButton>
        )}
      </div>

      {isMinivolley && (
        <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-sm shadow-sea-950/5">
          {(["all", "allenamenti", "tornei"] as const).map((value) => (
            <Link
              key={value}
              href={value === "all" ? "/admin/allenamenti/elenco" : `/admin/allenamenti/elenco?type=${value}`}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                activeType === value
                  ? "bg-sea-700 text-white shadow-sm"
                  : "text-foreground/60 hover:bg-surface-muted",
              )}
            >
              {value === "all" ? "Tutti" : value === "allenamenti" ? "Allenamenti" : "Tornei"}
            </Link>
          ))}
        </div>
      )}

      {trainings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessun allenamento configurato. Creane uno per farlo comparire nel calendario pubblico.
        </div>
      ) : (
        <TrainingList trainings={trainings} upcomingLinkedCountByRule={upcomingLinkedCountByRule} />
      )}
    </div>
  );
}
