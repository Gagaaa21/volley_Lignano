import type { Metadata } from "next";
import { CalendarClock, Lock, MessageSquareText, PauseCircle } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/guard";
import { answerWhen } from "@/lib/availability/format";
import { missingAvailabilityTables } from "@/lib/availability/health";
import { rulesSummary } from "@/lib/availability/reporting";
import { AvailabilityDatabaseNotice } from "@/components/availability/AvailabilityDatabaseNotice";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssenzeTabs } from "../AssenzeTabs";
import { loadReporting } from "../load";
import { RulesForm } from "./RulesForm";

export const metadata: Metadata = {
  title: "Regole delle assenze",
};

/** Le regole delle segnalazioni dei genitori per tutte le partite, con in breve come funzionano insieme alle scelte partita per partita. */
export default async function AssenzeRegolePage() {
  const session = await requireStaffPage("partite");
  const repo = await getActiveRepo();
  const [missing, { rules }] = await Promise.all([missingAvailabilityTables(repo), loadReporting(repo, [])]);

  return (
    <div>
      <PageHeader
        title="Assenze"
        description="Fino a quando i genitori possono segnalare un'assenza dal loro link, per tutte le partite. Per una partita sola si sceglie a mano da «Partite»."
      />
      <AssenzeTabs active="regole" />

      <AvailabilityDatabaseNotice missing={missing} isDev={session.role === "dev"} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Regole per tutte le partite</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Adesso: si chiudono <b className="font-semibold text-foreground/80">{rulesSummary(rules)}</b>
              {rules.paused ? " (ma sono sospese)" : ""}.
            </p>
          </CardHeader>
          <CardBody>
            <RulesForm
              rules={rules}
              changed={rules.updatedAt ? `Cambiate da ${rules.updatedBy ?? "qualcuno dello staff"} · ${answerWhen(rules.updatedAt)}` : null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Come funziona</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3.5 text-[13px] leading-relaxed text-foreground/80">
              <li className="flex gap-2.5">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>Ogni partita si chiude da sola alla scadenza di queste regole; la pagina del genitore la scrive sotto ogni partita.</span>
              </li>
              <li className="flex gap-2.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Per una partita sola, in «Partite», la chiudi adesso, la riapri fino all&apos;inizio o le dai un&apos;altra scadenza; puoi anche non
                  chiedere niente ai genitori per quella partita.
                </span>
              </li>
              <li className="flex gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>Con la pausa i genitori vedono le partite ma non possono segnalare; lo staff sì, sempre.</span>
              </li>
              <li className="flex gap-2.5">
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>L&apos;avviso compare in cima alla pagina di ogni genitore; un messaggio su una partita sola si scrive in «Partite».</span>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
