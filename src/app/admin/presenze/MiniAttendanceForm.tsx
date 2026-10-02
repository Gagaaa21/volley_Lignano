"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/Field";
import { groupDotClass, groupLabel } from "@/lib/category";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { saveMiniAttendanceAction, type MiniAttendanceFormState } from "./actions";
import { MINIVOLLEY_GROUPS, type Athlete } from "@/lib/types";

const initialState: MiniAttendanceFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="shrink-0">
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
    ...MINIVOLLEY_GROUPS.map((g) => ({
      label: groupLabel(g),
      dot: groupDotClass(g),
      athletes: athletes.filter((a) => a.group === g),
    })),
    { label: groupLabel(null), dot: groupDotClass(null), athletes: athletes.filter((a) => a.group === null) },
  ].filter((g) => g.athletes.length > 0);

  return (
    <form action={formAction} noValidate>
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

      <p className="mb-4 text-sm text-muted-foreground">Tocca chi è presente: le altre restano assenti.</p>

      <div className="space-y-7">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2.5 flex items-center gap-2 px-1 text-sm font-bold text-foreground">
              <span className={cn("h-2.5 w-2.5 rounded-full", group.dot)} aria-hidden />
              {group.label}
              <span className="font-medium text-muted-foreground">
                · {group.athletes.filter((a) => present.has(a.id)).length}/{group.athletes.length}
              </span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.athletes.map((athlete) => {
                const isPresent = present.has(athlete.id);
                return (
                  <button
                    key={athlete.id}
                    type="button"
                    onClick={() => toggle(athlete.id)}
                    aria-pressed={isPresent}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      isPresent
                        ? "border-success/40 bg-success-soft"
                        : "border-border bg-card hover:border-border-strong hover:bg-surface-muted",
                    )}
                  >
                    <Avatar name={athlete.fullName} size="sm" tone={isPresent ? "primary" : "neutral"} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{athlete.fullName}</span>
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                        isPresent ? "border-success bg-success text-white" : "border-border-strong",
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
        <div className="mt-4 rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex items-center justify-between gap-4 rounded-b-2xl border-t border-border bg-card/95 px-5 py-3.5 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="text-sm text-muted-foreground">
          <span className="font-display text-lg font-bold text-foreground">{present.size}</span> presenti su{" "}
          {athletes.length}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
