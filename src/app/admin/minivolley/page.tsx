import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Pencil, Plus, Trophy } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { formatDateShort, formatWeekdays } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deleteTrainingAction } from "../allenamenti/actions";

export const metadata: Metadata = {
  title: "Minivolley",
};

export default async function MinivolleyListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const activeType: "all" | "allenamenti" | "tornei" =
    type === "allenamenti" || type === "tornei" ? type : "all";

  const repo = await getActiveRepo();
  const allTrainings = await repo.listTrainings({ team: "minivolley" });
  const trainings = allTrainings.filter((t) => {
    if (activeType === "allenamenti") return !t.isTournament;
    if (activeType === "tornei") return t.isTournament;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Minivolley</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Allenamenti e tornei della squadra Minivolley, con pagina pubblica separata.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <LinkButton href="/admin/minivolley/nuovo">
            <Plus className="h-4 w-4" />
            Nuovo allenamento
          </LinkButton>
          <LinkButton href="/admin/minivolley/nuovo?type=torneo" variant="outline">
            <Trophy className="h-4 w-4" />
            Nuovo torneo
          </LinkButton>
        </div>
      </div>

      <div className="mt-5 inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 shadow-sm shadow-sea-950/5">
        {(["all", "allenamenti", "tornei"] as const).map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/minivolley" : `/admin/minivolley?type=${value}`}
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

      {trainings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessun allenamento o torneo in programma.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {trainings.map((training) => (
            <Card key={training.id}>
              <CardBody className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-base font-bold text-foreground">{training.title}</h2>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {training.isTournament && (
                      <Badge className="bg-foreground/8 text-foreground/60">Torneo</Badge>
                    )}
                    <Badge
                      className={
                        training.isActive
                          ? "bg-[var(--color-u14-soft)] text-[var(--color-u14-strong)]"
                          : "bg-foreground/10 text-foreground/50"
                      }
                    >
                      {training.isActive ? "Attivo" : "Non attivo"}
                    </Badge>
                  </div>
                </div>

                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-sea-700">
                  {training.repeat === "once" ? (
                    <>
                      <CalendarDays className="h-3.5 w-3.5" />
                      Singolo giorno
                    </>
                  ) : (
                    formatWeekdays(training.weekdays)
                  )}
                </p>

                <div className="mt-2 space-y-1.5 text-sm text-foreground/65">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0" />
                    {training.startTime}–{training.endTime}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{training.location}</span>
                  </p>
                </div>

                <p className="mt-3 text-xs text-foreground/45">
                  {training.repeat === "once"
                    ? `Il ${formatDateShort(training.startDate)}`
                    : `Dal ${formatDateShort(training.startDate)}${
                        training.endDate ? ` al ${formatDateShort(training.endDate)}` : " · senza scadenza"
                      }`}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-4">
                  <LinkButton
                    href={`/admin/minivolley/${training.id}`}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifica
                  </LinkButton>
                  <form action={deleteTrainingAction}>
                    <input type="hidden" name="id" value={training.id} />
                    <ConfirmSubmitButton
                      confirmMessage={`Eliminare "${training.title}" (${
                        training.repeat === "once"
                          ? formatDateShort(training.startDate)
                          : formatWeekdays(training.weekdays)
                      })?`}
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/8"
                    >
                      Elimina
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
