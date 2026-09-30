"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { groupLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { saveMiniAttendanceAction, type MiniAttendanceFormState } from "./actions";
import { MINIVOLLEY_GROUPS, type Athlete } from "@/lib/types";

const initialState: MiniAttendanceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="h-4 w-4" />
      {pending ? "Salvataggio…" : "Salva presenze"}
    </Button>
  );
}

/** Registro presenze del Minivolley: stessa anagrafica di U14/U15, ma qui si
 * tocca solo chi era presente (nessuna assenza tracciata, opposto di
 * AttendanceForm che parte "Presente" per tutte) — un tocco per atleta,
 * raggruppate per CDA per ritrovarle più in fretta a bordo campo. */
export function MiniAttendanceForm({
  athletes,
  initialPresentIds,
  sessionId,
  trainingRuleId,
  sessionDate,
  title,
  location,
}: {
  athletes: Athlete[];
  initialPresentIds: string[];
  sessionId?: string;
  trainingRuleId: string | null;
  sessionDate: string;
  title: string;
  location: string;
}) {
  const [present, setPresent] = useState<Set<string>>(() => new Set(initialPresentIds));
  const [state, formAction] = useActionState(saveMiniAttendanceAction, initialState);

  function toggle(athleteId: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) next.delete(athleteId);
      else next.add(athleteId);
      return next;
    });
  }

  const groups = [
    ...MINIVOLLEY_GROUPS.map((g) => ({ label: groupLabel(g), athletes: athletes.filter((a) => a.group === g) })),
    { label: groupLabel(null), athletes: athletes.filter((a) => a.group === null) },
  ].filter((g) => g.athletes.length > 0);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      {trainingRuleId && <input type="hidden" name="trainingRuleId" value={trainingRuleId} />}
      <input type="hidden" name="sessionDate" value={sessionDate} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="athleteIds" value={athletes.map((a) => a.id).join(",")} />
      {athletes.map((athlete) =>
        present.has(athlete.id) ? (
          <input key={athlete.id} type="hidden" name={`present_${athlete.id}`} value="on" />
        ) : null,
      )}

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{present.size}</span> presenti su {athletes.length}
      </p>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="eyebrow">{group.label}</p>
            <div className="mt-3 space-y-2">
              {group.athletes.map((athlete) => {
                const isPresent = present.has(athlete.id);
                return (
                  <button
                    key={athlete.id}
                    type="button"
                    onClick={() => toggle(athlete.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                      isPresent
                        ? "border-primary/40 bg-primary/10"
                        : "border-border-subtle bg-surface hover:bg-muted/60",
                    )}
                  >
                    <span className="truncate font-medium text-foreground">{athlete.fullName}</span>
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                        isPresent ? "border-primary bg-primary text-primary-foreground" : "border-border-subtle",
                      )}
                    >
                      {isPresent && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
