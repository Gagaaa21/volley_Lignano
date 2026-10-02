"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { categoryLabel } from "@/lib/category";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { saveAttendanceAction, type AttendanceFormState } from "./actions";
import type { Athlete, AttendanceStatus } from "@/lib/types";

const initialState: AttendanceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="shrink-0">
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva presenze"}
    </Button>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
  tone = "success",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "success" | "danger" | "warning";
}) {
  const activeClass =
    tone === "danger"
      ? "bg-destructive text-destructive-foreground shadow-xs"
      : tone === "warning"
        ? "bg-warning text-white shadow-xs"
        : "bg-success text-white shadow-xs";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
        active ? activeClass : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function AttendanceForm({
  athletes,
  initialRecords,
  sessionId,
  trainingRuleId,
  sessionDate,
  title,
  location,
}: {
  athletes: Athlete[];
  initialRecords: Record<string, AttendanceStatus>;
  sessionId?: string;
  trainingRuleId: string | null;
  sessionDate: string;
  title: string;
  location: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const init: Record<string, AttendanceStatus> = {};
    for (const athlete of athletes) {
      init[athlete.id] = initialRecords[athlete.id] ?? "present";
    }
    return init;
  });
  const [state, formAction] = useActionState(saveAttendanceAction, initialState);

  const setStatus = (athleteId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [athleteId]: status }));
  };

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;

  const absentCount = athletes.length - presentCount;

  return (
    <form action={formAction} noValidate>
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      {trainingRuleId && <input type="hidden" name="trainingRuleId" value={trainingRuleId} />}
      <input type="hidden" name="sessionDate" value={sessionDate} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="athleteIds" value={athletes.map((a) => a.id).join(",")} />

      <p className="mb-3 text-sm text-muted-foreground">
        Tutte partono <span className="font-semibold text-success">presenti</span>: segna solo le assenze.
      </p>

      <div className="space-y-2">
        {athletes.map((athlete) => {
          const status = statuses[athlete.id];
          const isPresent = status === "present";
          return (
            <div
              key={athlete.id}
              className={cn(
                "rounded-xl border px-3 py-2.5 transition-colors sm:px-4",
                isPresent ? "border-border bg-card" : "border-destructive/25 bg-destructive/[0.035]",
              )}
            >
              <input type="hidden" name={`status_${athlete.id}`} value={status} />
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={athlete.fullName}
                    size="sm"
                    tone={athlete.category === "U14" ? "u14" : athlete.category === "U15" ? "u15" : "neutral"}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{athlete.fullName}</p>
                    <p className="text-xs text-muted-foreground">{categoryLabel(athlete.category)}</p>
                  </div>
                </div>
                <div className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto">
                  <SegmentButton active={isPresent} onClick={() => setStatus(athlete.id, "present")}>
                    <Check className="h-3.5 w-3.5" />
                    Presente
                  </SegmentButton>
                  <SegmentButton active={!isPresent} tone="danger" onClick={() => setStatus(athlete.id, "unexcused")}>
                    <X className="h-3.5 w-3.5" />
                    Assente
                  </SegmentButton>
                </div>
              </div>

              {!isPresent && (
                <div className="mt-2.5 flex gap-1 rounded-xl bg-muted p-1">
                  <SegmentButton
                    active={status === "excused"}
                    tone="warning"
                    onClick={() => setStatus(athlete.id, "excused")}
                  >
                    Assenza giustificata
                  </SegmentButton>
                  <SegmentButton
                    active={status === "unexcused"}
                    tone="danger"
                    onClick={() => setStatus(athlete.id, "unexcused")}
                  >
                    Assenza non giustificata
                  </SegmentButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {state.error && (
        <div className="mt-4 rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-5 mt-5 flex items-center justify-between gap-4 rounded-b-2xl border-t border-border bg-card/95 px-5 py-3.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <span className="font-display text-lg font-bold text-foreground">{presentCount}</span> presenti su{" "}
            {athletes.length}
          </p>
          {absentCount > 0 && (
            <p className="text-xs font-semibold text-destructive">
              {absentCount} assent{absentCount === 1 ? "e" : "i"}
            </p>
          )}
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}
