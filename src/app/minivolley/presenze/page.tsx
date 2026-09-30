import type { Metadata } from "next";
import { ArrowLeft, ClipboardCheck, Users } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody } from "@/components/ui/Card";
import { getPublicAttendanceTally, type PublicAttendanceTallyRow } from "@/lib/publicCalendarData";
import { groupLabel } from "@/lib/category";
import { MINIVOLLEY_GROUPS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Presenze Minivolley",
};

function TallyGroup({ label, rows }: { label: string; rows: PublicAttendanceTallyRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <Card className="mt-3">
        <CardBody className="p-0">
          <ul className="divide-y divide-border-subtle">
            {rows.map((row) => (
              <li key={row.fullName} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="icon-chip shrink-0">
                    <Users className="h-4 w-4" />
                  </span>
                  <span className="truncate font-medium text-foreground">{row.fullName}</span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                  {row.count} {row.count === 1 ? "presenza" : "presenze"}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

export default async function MinivolleyPresenzePage() {
  const rows = await getPublicAttendanceTally("minivolley");

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader team="minivolley" />

      <section className="auth-stage">
        <div className="mx-auto max-w-3xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <LinkButton href="/minivolley" variant="ghost" size="sm" className="-ml-3.5">
            <ArrowLeft className="h-4 w-4" />
            Torna al calendario
          </LinkButton>

          <p className="eyebrow mt-4">
            <ClipboardCheck className="h-3 w-3" />
            Minivolley
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Presenze
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Quante volte ogni atleta è stata presente agli allenamenti, aggiornato a ogni
            registrazione dello staff.
          </p>
        </div>
      </section>

      <main className="app-surface w-full flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
              Nessuna presenza registrata per ora.
            </div>
          ) : (
            <div className="space-y-8">
              {MINIVOLLEY_GROUPS.map((g) => (
                <TallyGroup key={g} label={groupLabel(g)} rows={rows.filter((r) => r.group === g)} />
              ))}
              <TallyGroup label={groupLabel(null)} rows={rows.filter((r) => r.group === null)} />
            </div>
          )}
        </div>
      </main>

      <PublicFooter tagline="Minivolley · Lignano Sabbiadoro" />
    </div>
  );
}
