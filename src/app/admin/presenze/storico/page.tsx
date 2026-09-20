import type { Metadata } from "next";
import { ArrowLeft, Check, MapPin, ShieldAlert, ShieldQuestion, X } from "lucide-react";
import { getRepo } from "@/lib/db";
import { formatDateLong } from "@/lib/format";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deleteAttendanceSessionAction } from "../actions";

export const metadata: Metadata = {
  title: "Storico presenze",
};

export default async function AttendanceHistoryPage() {
  const repo = await getRepo();
  const sessions = await repo.listAttendanceSessions();

  return (
    <div>
      <LinkButton href="/admin/presenze" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle presenze
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Storico presenze</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tutti i registri salvati, dal più recente.
      </p>

      {sessions.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun registro ancora. Registra le presenze di un allenamento dalla schermata principale.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sessions.map((s) => {
            const statuses = Object.values(s.records);
            const present = statuses.filter((v) => v === "present").length;
            const excused = statuses.filter((v) => v === "excused").length;
            const unexcused = statuses.filter((v) => v === "unexcused").length;
            return (
              <Card key={s.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3 pt-5">
                  <div className="min-w-0">
                    <p className="font-semibold capitalize text-foreground">
                      {formatDateLong(s.sessionDate)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {s.title} · {s.location}
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1 text-[var(--color-u14-strong)]">
                        <Check className="h-3.5 w-3.5" />
                        {present} presenti
                      </span>
                      <span className="flex items-center gap-1 text-[var(--color-sand-700)]">
                        <ShieldQuestion className="h-3.5 w-3.5" />
                        {excused} giustificate
                      </span>
                      <span className="flex items-center gap-1 text-destructive">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {unexcused} non giustificate
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LinkButton href={`/admin/presenze/storico/${s.id}`} variant="outline" size="sm">
                      Apri
                    </LinkButton>
                    <form action={deleteAttendanceSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Eliminare il registro di "${s.title}" del ${formatDateLong(s.sessionDate)}?`}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/8"
                      >
                        <X className="h-3.5 w-3.5" />
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
