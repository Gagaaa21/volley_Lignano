"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { refreshOfficialResultsAction, type OfficialResultFormState } from "./official-actions";

const initialState: OfficialResultFormState = {};

/** «Aggiorna ora»: rilegge subito classifiche e risultati dal portale. */
export function RefreshOfficialButton() {
  const [state, formAction, pending] = useActionState(refreshOfficialResultsAction, initialState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {pending ? "Aggiorno…" : "Aggiorna ora"}
      </Button>
      {state.error && <p className="max-w-xs text-right text-xs font-medium text-destructive">{state.error}</p>}
      {state.message && <p className="text-xs font-medium text-success">{state.message}</p>}
    </form>
  );
}
