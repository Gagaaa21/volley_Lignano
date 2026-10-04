"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/category";
import type { FederationSnapshot, FederationSource } from "@/lib/federation/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, Input, Label, Textarea, Toggle } from "@/components/ui/Field";
import { saveFederationSourceAction, type FederationSourceFormState } from "./actions";

const initialState: FederationSourceFormState = {};

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceForm({ source, snapshot }: { source: FederationSource; snapshot: FederationSnapshot | null }) {
  const [state, formAction, pending] = useActionState(saveFederationSourceAction, initialState);
  const label = CATEGORY_LABELS[source.category];

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border p-4" noValidate>
      <input type="hidden" name="category" value={source.category} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[15px] font-bold text-foreground">{label}</h3>
        {!source.url ? (
          <Badge tone="neutral">Girone non ancora pubblicato</Badge>
        ) : snapshot?.girone ? (
          <Badge tone="success">
            Letto il {snapshot.fetchedAt ? formatMoment(snapshot.fetchedAt) : "—"} · {snapshot.girone.standings.length}{" "}
            squadre, {snapshot.girone.matches.length} gare
          </Badge>
        ) : (
          <Badge tone="warning">Non ancora letto</Badge>
        )}
      </div>

      <div>
        <Label htmlFor={`url-${source.category}`}>Pagina del girone sul portale</Label>
        <Input
          id={`url-${source.category}`}
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://udine.federvolley.it/risultati-classifiche.aspx?…"
          defaultValue={source.url ?? ""}
        />
        <FieldHint>
          Apri sul portale federale il girone in cui gioca la squadra e copia l&apos;indirizzo dalla barra del browser.
          Lascia vuoto finché il girone non è pubblicato.
        </FieldHint>
      </div>

      <div>
        <Label htmlFor={`aliases-${source.category}`}>Come compare la nostra squadra nel girone</Label>
        <Textarea
          id={`aliases-${source.category}`}
          name="aliases"
          rows={2}
          className="min-h-16"
          defaultValue={source.teamAliases.join("\n")}
        />
        <FieldHint>Uno per riga, scritto come sul portale (es. CDA VOLLEY LIGNANO).</FieldHint>
      </div>

      <Toggle
        name="enabled"
        defaultChecked={source.enabled}
        label="Usa questo girone"
        description="Spento: classifica e risultati di questa categoria non vengono letti né mostrati."
      />

      {snapshot?.lastError && (
        <div className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
          Ultima lettura non riuscita{snapshot.lastErrorAt ? ` (${formatMoment(snapshot.lastErrorAt)})` : ""}:{" "}
          {snapshot.lastError}
        </div>
      )}
      {state.error && (
        <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5">
          <FieldError>{state.error}</FieldError>
        </div>
      )}
      {state.message && <p className="text-sm font-medium text-primary">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" />
        {pending ? "Salvo e leggo…" : "Salva e leggi ora"}
      </Button>
    </form>
  );
}

export function FederationSourcesForm({
  sources,
  snapshots,
}: {
  sources: FederationSource[];
  snapshots: FederationSnapshot[];
}) {
  return (
    <div className="space-y-4">
      {sources.map((source) => (
        <SourceForm
          key={source.category}
          source={source}
          snapshot={snapshots.find((snap) => snap.category === source.category) ?? null}
        />
      ))}
    </div>
  );
}
