"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, Clock, Layers } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeading } from "@/components/ui/PageHeader";

export interface SchedeCardData {
  id: string;
  title: string;
  notes: string | null;
  blockCount: number;
  totalMinutes: number;
  upcomingCount: number;
  nearestDateLabel: string | null;
}

function PlanRow({ plan }: { plan: SchedeCardData }) {
  return (
    <Link
      href={`/admin/schede/${plan.id}`}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:px-5"
    >
      <span className="icon-chip h-10 w-10 shadow-none">
        <ClipboardList className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground group-hover:text-primary">{plan.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {plan.blockCount} blocch{plan.blockCount === 1 ? "o" : "i"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular">{plan.totalMinutes}&apos;</span>
          </span>
          {plan.notes && <span className="hidden min-w-0 truncate sm:inline">{plan.notes}</span>}
        </span>
      </span>
      {plan.upcomingCount > 0 && (
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary sm:inline-flex">
          <CalendarDays className="h-3.5 w-3.5" />
          {plan.upcomingCount === 1 ? plan.nearestDateLabel : `${plan.upcomingCount} date`}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function SchedeLibrary({ plans }: { plans: SchedeCardData[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) => p.title.toLowerCase().includes(q) || (p.notes ?? "").toLowerCase().includes(q));
  }, [plans, query]);

  const inProgramma = filtered.filter((p) => p.upcomingCount > 0);
  const libreria = filtered.filter((p) => p.upcomingCount === 0);

  return (
    <div data-tour="section-schede-cards">
      {plans.length > 5 && (
        <div data-tour="section-schede-search" className="mb-6">
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per titolo o note…" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessuna scheda trovata per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="space-y-9">
          {inProgramma.length > 0 && (
            <section>
              <SectionHeading title="In programma" description="Collegate ad almeno una data futura del calendario." />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {inProgramma.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          )}

          {libreria.length > 0 && (
            <section>
              <SectionHeading title="Libreria" description="Non ancora assegnate a una data: pronte da riusare." />
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {libreria.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
