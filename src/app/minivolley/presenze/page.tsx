import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPublicAttendanceTally, type PublicAttendanceTallyRow } from "@/lib/publicCalendarData";
import { groupDotClass, groupLabel } from "@/lib/category";
import { cn } from "@/lib/cn";
import { MINIVOLLEY_GROUPS, type MinivolleyGroup } from "@/lib/types";

export const metadata: Metadata = {
  title: "Presenze Minivolley",
};

function TallyGroup({
  group,
  rows,
  max,
}: {
  group: MinivolleyGroup | null;
  rows: PublicAttendanceTallyRow[];
  max: number;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <span className={cn("h-2.5 w-2.5 rounded-full", groupDotClass(group))} aria-hidden />
          {groupLabel(group)}
        </h2>
        <p className="text-[13px] font-medium text-muted-foreground">
          {rows.length} {rows.length === 1 ? "iscritto" : "iscritti"}
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {rows.map((row) => (
          <li key={row.fullName} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Avatar name={row.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-foreground">{row.fullName}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${max > 0 ? Math.max(4, Math.round((row.count / max) * 100)) : 0}%` }}
                />
              </div>
            </div>
            <p className="w-16 shrink-0 text-right">
              <span className="display-wide tabular text-xl leading-none text-foreground">{row.count}</span>
              <span className="block text-[11px] font-medium text-muted-foreground">
                {row.count === 1 ? "presenza" : "presenze"}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function MinivolleyPresenzePage() {
  const rows = await getPublicAttendanceTally("minivolley");
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader team="minivolley" />

      <section className="auth-stage border-b border-border">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8">
          <Link
            href="/minivolley"
            className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Calendario
          </Link>
          <p className="eyebrow mt-5">Minivolley</p>
          <h1 className="display-wide mt-2 text-[2.375rem] leading-[1.02] text-foreground sm:text-5xl">Presenze</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Quante volte ogni bambina e bambino è stato presente agli allenamenti, aggiornato a ogni
            registrazione dello staff.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nessuna presenza registrata per ora."
            description="Appena lo staff registra il primo allenamento, qui compare il conteggio."
          />
        ) : (
          <div className="space-y-9">
            {MINIVOLLEY_GROUPS.map((g) => (
              <TallyGroup key={g} group={g} rows={rows.filter((r) => r.group === g)} max={max} />
            ))}
            <TallyGroup group={null} rows={rows.filter((r) => r.group === null)} max={max} />
          </div>
        )}
      </main>

      <PublicFooter tagline="Minivolley · Lignano Sabbiadoro" team="minivolley" />
    </div>
  );
}
