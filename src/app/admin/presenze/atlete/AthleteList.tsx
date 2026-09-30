"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search } from "lucide-react";
import { categoryLabel, groupLabel } from "@/lib/category";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { MINIVOLLEY_GROUPS, type Athlete, type TrainingTeam } from "@/lib/types";
import { deleteAthleteAction } from "./actions";

function AthleteGroup({ label, athletes }: { label: string; athletes: Athlete[] }) {
  if (athletes.length === 0) return null;
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {athletes.map((athlete) => (
          <Card key={athlete.id}>
            <CardBody className="flex items-center justify-between gap-3 pt-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/presenze/atleta/${athlete.id}`}
                    className="truncate font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {athlete.fullName}
                  </Link>
                  {!athlete.isActive && (
                    <Badge className="bg-foreground/10 text-foreground/50">Non attiva</Badge>
                  )}
                </div>
                {athlete.notes && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{athlete.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <LinkButton
                  href={`/admin/presenze/atlete/${athlete.id}`}
                  variant="outline"
                  size="sm"
                  aria-label="Modifica"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </LinkButton>
                <form action={deleteAthleteAction}>
                  <input type="hidden" name="id" value={athlete.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Eliminare definitivamente ${athlete.fullName}? Le presenze registrate resteranno ma senza nome collegato.`}
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
    </div>
  );
}

/** Elenco atlete con ricerca (mostrata solo oltre 5 nominativi, stesso
 * limite già usato in SchedeLibrary) e raggruppamento per categoria
 * (u14u15) o gruppo CDA (Minivolley), filtro applicato prima del
 * raggruppamento così ogni sezione mostra solo i risultati pertinenti. */
export function AthleteList({ athletes, team }: { athletes: Athlete[]; team: TrainingTeam }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => a.fullName.toLowerCase().includes(q));
  }, [athletes, query]);

  return (
    <div>
      {athletes.length > 5 && (
        <div className="relative mb-6 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary/40 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna atleta trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="space-y-8">
          {team === "u14u15" ? (
            <>
              <AthleteGroup label={categoryLabel("U14")} athletes={filtered.filter((a) => a.category === "U14")} />
              <AthleteGroup label={categoryLabel("U15")} athletes={filtered.filter((a) => a.category === "U15")} />
              <AthleteGroup label={categoryLabel(null)} athletes={filtered.filter((a) => a.category === null)} />
            </>
          ) : (
            <>
              {MINIVOLLEY_GROUPS.map((g) => (
                <AthleteGroup key={g} label={groupLabel(g)} athletes={filtered.filter((a) => a.group === g)} />
              ))}
              <AthleteGroup label={groupLabel(null)} athletes={filtered.filter((a) => a.group === null)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
