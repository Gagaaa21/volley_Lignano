"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
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
        <div className="space-y-2">
          {filtered.map((athlete) => (
            <Link key={athlete.id} href={`/admin/test-fisici/atleta/${athlete.id}`} className="block">
              <Card className="transition-colors hover:border-primary/30">
                <CardBody className="flex items-center justify-between gap-3 pt-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{athlete.fullName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {athlete.sessionCount === 0
                        ? "Nessun dato registrato"
                        : `${athlete.sessionCount} ${athlete.sessionCount === 1 ? "sessione" : "sessioni"} · ultima il ${formatDateShort(athlete.lastDate!)}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground/30" />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
