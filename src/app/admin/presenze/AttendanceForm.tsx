"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { categoryBadgeClass, categoryLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { saveAttendanceAction, type AttendanceFormState } from "./actions";
import type { Athlete, AttendanceStatus } from "@/lib/types";

const initialState: AttendanceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva presenze"}
    </Button>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
        active
          ? tone === "danger"
            ? "bg-destructive text-destructive-foreground"
            : "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
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

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      {trainingRuleId && <input type="hidden" name="trainingRuleId" value={trainingRuleId} />}
      <input type="hidden" name="sessionDate" value={sessionDate} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="athleteIds" value={athletes.map((a) => a.id).join(",")} />

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{presentCount}</span> presenti su{" "}
        {athletes.length}
      </p>

      <div className="space-y-2.5">
        {athletes.map((athlete) => {
          const status = statuses[athlete.id];
          const isPresent = status === "present";
          return (
            <div
              key={athlete.id}
              className="rounded-xl border border-border-subtle bg-surface px-4 py-3.5"
            >
              <input type="hidden" name={`status_${athlete.id}`} value={status} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate font-medium text-foreground">{athlete.fullName}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      categoryBadgeClass(athlete.category),
                    )}
                  >
                    {categoryLabel(athlete.category)}
                  </span>
                </div>
                <div className="flex w-full max-w-[220px] gap-1.5 sm:w-auto">
                  <ToggleButton active={isPresent} onClick={() => setStatus(athlete.id, "present")}>
                    <span className="flex items-center justify-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Presente
                    </span>
                  </ToggleButton>
                  <ToggleButton
                    active={!isPresent}
                    tone="danger"
                    onClick={() => setStatus(athlete.id, "unexcused")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <X className="h-3.5 w-3.5" />
                      Assente
                    </span>
                  </ToggleButton>
                </div>
              </div>

              {!isPresent && (
                <div className="mt-2.5 flex gap-1.5 border-t border-border-subtle pt-2.5">
                  <ToggleButton
                    active={status === "excused"}
                    onClick={() => setStatus(athlete.id, "excused")}
                  >
                    Assenza giustificata
                  </ToggleButton>
                  <ToggleButton
                    active={status === "unexcused"}
                    tone="danger"
                    onClick={() => setStatus(athlete.id, "unexcused")}
                  >
                    Assenza non giustificata
                  </ToggleButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
