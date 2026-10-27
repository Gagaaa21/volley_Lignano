"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { MAX_DAYS_BEFORE, MAX_NOTICE_LENGTH, type ReportingRules } from "@/lib/availability/reporting";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, Input, Label, RadioSegment, Textarea, Toggle } from "@/components/ui/Field";
import { saveReportingRulesAction, type RulesFormState } from "../reporting-actions";

/**
 * Le regole per tutte le partite: quanti giorni prima si chiudono da sole le segnalazioni e a che ora, la pausa per tutte e un avviso
 * in cima alla pagina dei genitori. Partita per partita si cambia a mano dalla parte «Partite» della sezione.
 */
export function RulesForm({ rules, changed }: { rules: ReportingRules; changed: string | null }) {
  const [state, formAction, pending] = useActionState<RulesFormState, FormData>(saveReportingRulesAction, {});
  const [mode, setMode] = useState<"match" | "fixed">(rules.closingTime ? "fixed" : "match");

  return (
    <form action={formAction} className="space-y-5" data-reporting-rules>
      <div className="space-y-4">
        <div>
          <Label htmlFor="daysBefore">Giorni prima</Label>
          <Input
            id="daysBefore"
            name="daysBefore"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_DAYS_BEFORE}
            defaultValue={rules.daysBefore}
            className="w-28"
            required
            data-rules-days
          />
          <FieldHint>0 = fino all&apos;inizio della partita.</FieldHint>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-foreground/80">A che ora</span>
          <RadioSegment
            className="max-w-sm"
            name="closingMode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "match", label: "Ora della partita" },
              { value: "fixed", label: "Ora fissa" },
            ]}
          />
          {mode === "fixed" && (
            <Input
              name="closingTime"
              type="time"
              className="mt-2 w-36"
              defaultValue={rules.closingTime ?? "21:00"}
              aria-label="Ora di chiusura"
              required
              data-rules-time
            />
          )}
        </div>
      </div>

      <Toggle
        name="paused"
        defaultChecked={rules.paused}
        label="Sospendi le segnalazioni per tutte le partite"
        description="I genitori vedono le partite ma non possono segnalare (per esempio durante una pausa del campionato). Lo staff può sempre."
        data-rules-paused
      />

      <div>
        <Label htmlFor="notice">Avviso per i genitori</Label>
        <Textarea
          id="notice"
          name="notice"
          rows={2}
          maxLength={MAX_NOTICE_LENGTH}
          defaultValue={rules.notice ?? ""}
          placeholder="Es. Per il torneo di Natale segnalate entro il 10 dicembre."
          data-rules-notice
        />
        <FieldHint>Compare in cima alla pagina del link di ogni genitore. Lascialo vuoto per non mostrare niente.</FieldHint>
      </div>

      <FieldError>{state.error}</FieldError>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} data-rules-save>
          {pending ? "Salvataggio…" : "Salva le regole"}
        </Button>
        {state.ok && !pending && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success" data-rules-saved>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Salvate
          </span>
        )}
      </div>
      {changed && <p className="text-[12px] text-muted-foreground" data-rules-changed>{changed}</p>}
    </form>
  );
}
