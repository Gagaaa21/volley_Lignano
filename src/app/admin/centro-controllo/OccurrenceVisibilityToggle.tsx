"use client";

import { Globe, Lock } from "lucide-react";
import { setOccurrencePlanAction } from "../allenamenti/actions";
import { cn } from "@/lib/cn";

/** Attiva/disattiva la visibilità pubblica di una scheda collegata, senza
 * dover aprire la pagina del singolo allenamento: invio automatico al
 * cambio, riusando la stessa azione già usata lì. */
export function OccurrenceVisibilityToggle({
  ruleId,
  date,
  planId,
  isPublic,
}: {
  ruleId: string;
  date: string;
  planId: string;
  isPublic: boolean;
}) {
  return (
    <form action={setOccurrencePlanAction}>
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="planId" value={planId} />
      <label
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
          isPublic ? "bg-sea-700/10 text-sea-700" : "bg-foreground/8 text-foreground/50",
        )}
      >
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={isPublic}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="sr-only"
        />
        {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        {isPublic ? "Pubblica" : "Privata"}
      </label>
    </form>
  );
}
