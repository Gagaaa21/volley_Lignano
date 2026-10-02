"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { categoryDotClass, categoryLabel, groupDotClass, groupLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { Avatar, type AvatarTone } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { MINIVOLLEY_GROUPS, type Athlete, type TrainingTeam } from "@/lib/types";

function AthleteGroup({
  label,
  dotClass,
  tone,
  athletes,
}: {
  label: string;
  dotClass: string;
  tone: AvatarTone;
  athletes: Athlete[];
}) {
  if (athletes.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} aria-hidden />
          {label}
        </h2>
        <span className="text-[13px] text-muted-foreground">{athletes.length}</span>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {athletes.map((athlete) => (
          <div key={athlete.id} className={cn("flex items-center gap-1 pr-2", !athlete.isActive && "opacity-60")}>
            <Link
              href={`/admin/presenze/atleta/${athlete.id}`}
              className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5"
            >
              <Avatar name={athlete.fullName} tone={tone} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold text-foreground group-hover:text-primary">{athlete.fullName}</span>
                  {!athlete.isActive && <Badge>Non attiva</Badge>}
                </span>
                {athlete.notes && <span className="block truncate text-[13px] text-muted-foreground">{athlete.notes}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </Link>
            <Link
              href={`/admin/presenze/atlete/${athlete.id}`}
              aria-label={`Modifica ${athlete.fullName}`}
              title="Modifica"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Elenco atlete con ricerca (mostrata solo oltre 5 nominativi, stesso
 * limite già usato in SchedeLibrary) e raggruppamento per categoria
 * (u14u15) o gruppo CDA (Minivolley), filtro applicato prima del
 * raggruppamento così ogni sezione mostra solo i risultati pertinenti.
 * Ogni riga apre le presenze dell'atleta; la matita apre la modifica
 * (dove si trova anche l'eliminazione). */
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
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome…" className="mb-6" />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessuna atleta trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="space-y-9">
          {team === "u14u15" ? (
            <>
              <AthleteGroup
                label={categoryLabel("U14")}
                dotClass={categoryDotClass("U14")}
                tone="u14"
                athletes={filtered.filter((a) => a.category === "U14")}
              />
              <AthleteGroup
                label={categoryLabel("U15")}
                dotClass={categoryDotClass("U15")}
                tone="u15"
                athletes={filtered.filter((a) => a.category === "U15")}
              />
              <AthleteGroup
                label={categoryLabel(null)}
                dotClass={categoryDotClass(null)}
                tone="neutral"
                athletes={filtered.filter((a) => a.category === null)}
              />
            </>
          ) : (
            <>
              {MINIVOLLEY_GROUPS.map((g) => (
                <AthleteGroup
                  key={g}
                  label={groupLabel(g)}
                  dotClass={groupDotClass(g)}
                  tone="primary"
                  athletes={filtered.filter((a) => a.group === g)}
                />
              ))}
              <AthleteGroup
                label={groupLabel(null)}
                dotClass={groupDotClass(null)}
                tone="neutral"
                athletes={filtered.filter((a) => a.group === null)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
