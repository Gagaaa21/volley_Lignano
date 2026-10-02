"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatDateShort } from "@/lib/format";

export interface AthleteTestSummary {
  id: string;
  fullName: string;
  sessionCount: number;
  lastDate: string | null;
}

/** Elenco atlete con un riepilogo dei test registrati, stesso pattern di
 * AthletePicker (ricerca mostrata solo oltre 5 nominativi) ma qui si entra
 * nello storico di un'atleta invece che nell'inserimento: una lista piatta
 * di tutte le singole righe PhysicalTest (un salto = fino a 3 righe) era
 * illeggibile appena si registravano un paio di sessioni reali. */
export function TestFisiciHome({ athletes }: { athletes: AthleteTestSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => a.fullName.toLowerCase().includes(q));
  }, [athletes, query]);

  return (
    <div>
      {athletes.length > 5 && (
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per nome…" className="mb-5" />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessuna atleta trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {filtered.map((athlete) => (
            <Link
              key={athlete.id}
              href={`/admin/test-fisici/atleta/${athlete.id}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5"
            >
              <Avatar name={athlete.fullName} tone={athlete.sessionCount > 0 ? "primary" : "neutral"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground group-hover:text-primary">{athlete.fullName}</span>
                <span className="block text-[13px] text-muted-foreground">
                  {athlete.sessionCount === 0
                    ? "Nessun dato registrato"
                    : `${athlete.sessionCount} ${athlete.sessionCount === 1 ? "sessione" : "sessioni"} · ultima il ${formatDateShort(athlete.lastDate!)}`}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
