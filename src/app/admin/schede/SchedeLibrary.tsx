"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, ListChecks, Puzzle, Search } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

export interface SchedeCardData {
  id: string;
  title: string;
  notes: string | null;
  blockCount: number;
  totalMinutes: number;
  upcomingCount: number;
  nearestDateLabel: string | null;
}

function PlanCard({ plan }: { plan: SchedeCardData }) {
  return (
    <Link href={`/admin/schede/${plan.id}`} className="block">
      <Card className="h-full transition-colors hover:border-sea-300 hover:bg-sea-50/40">
        <CardBody className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-base font-bold text-foreground">{plan.title}</h2>
            {plan.upcomingCount > 0 && (
              <span className="shrink-0 rounded-full bg-[var(--color-training-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-training-strong)]">
                {plan.upcomingCount === 1 ? plan.nearestDateLabel : `${plan.upcomingCount} date`}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-foreground/55">
            <span className="flex items-center gap-1.5">
              <Puzzle className="h-3.5 w-3.5" />
              {plan.blockCount} blocch{plan.blockCount === 1 ? "o" : "i"}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {plan.totalMinutes}&apos; totali
            </span>
          </div>
          {plan.notes && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-foreground/45">
              <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">{plan.notes}</span>
            </p>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}

export function SchedeLibrary({ plans }: { plans: SchedeCardData[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) => p.title.toLowerCase().includes(q) || (p.notes ?? "").toLowerCase().includes(q),
    );
  }, [plans, query]);

  const inProgramma = filtered.filter((p) => p.upcomingCount > 0);
  const libreria = filtered.filter((p) => p.upcomingCount === 0);

  return (
    <div>
      {plans.length > 5 && (
        <div className="relative mt-6 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per titolo o note…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary/40 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessuna scheda trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <>
          {inProgramma.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow">In programma</p>
              <p className="mt-1 text-sm text-foreground/60">
                Collegate ad almeno una data futura nel calendario allenamenti.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {inProgramma.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </div>
          )}

          {libreria.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow">Libreria</p>
              <p className="mt-1 text-sm text-foreground/60">
                Non ancora assegnate a una data: puoi riusarle in qualsiasi momento.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {libreria.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
