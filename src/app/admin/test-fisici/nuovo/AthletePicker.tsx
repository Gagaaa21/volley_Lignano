"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import type { Athlete } from "@/lib/types";

/** Elenco atlete da scegliere per registrare un nuovo test, con ricerca
 * mostrata solo oltre 5 nominativi (stesso limite di AthleteList in
 * Presenze). Niente raggruppamento per categoria: questa sezione non
 * esiste per Minivolley, quindi qui c'è solo u14u15. */
export function AthletePicker({ athletes }: { athletes: Athlete[] }) {
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
              href={`/admin/test-fisici/nuovo/${athlete.id}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted sm:px-5"
            >
              <Avatar name={athlete.fullName} />
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground group-hover:text-primary">
                {athlete.fullName}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
