"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  applyPlanSplitAction,
  checkPlanSplitsAction,
  type PlanSplitProposal,
} from "./resplit-actions";

/** Schede mandate al server per ogni richiesta (ognuna è una chiamata all'IA). */
const CHUNK = 2;
/** Pausa tra una richiesta e l'altra: l'IA gratuita accetta poche richieste al minuto. */
const PAUSE_MS = 1500;

function durationLabel(minutes: number): string {
  return minutes > 0 ? `${minutes}'` : "—";
}

function BlockList({ blocks, tone }: { blocks: { title: string; durationMinutes: number }[]; tone: "old" | "new" }) {
  return (
    <ol className="space-y-1">
      {blocks.map((block, i) => (
        <li key={i} className="flex items-baseline gap-2 text-sm">
          <span className="tabular w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">{i + 1}.</span>
          <span className={cn("min-w-0 flex-1", tone === "old" ? "text-foreground/70" : "font-semibold text-foreground")}>
            {block.title}
          </span>
          <span className="tabular shrink-0 text-xs font-semibold text-muted-foreground">
            {durationLabel(block.durationMinutes)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Ricontrolla con l'IA la divisione in blocchi delle schede già salvate e
 * propone le correzioni: il testo dei blocchi non cambia, cambia solo dove
 * inizia ogni blocco. Ogni proposta si applica con un clic.
 */
export function PlanSplitCheck({ planIds, single = false }: { planIds: string[]; single?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [checked, setChecked] = useState(0);
  const [proposals, setProposals] = useState<PlanSplitProposal[]>([]);
  const [unchanged, setUnchanged] = useState(0);
  const [failed, setFailed] = useState(0);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function check() {
    setPhase("checking");
    setChecked(0);
    setProposals([]);
    setUnchanged(0);
    setFailed(0);
    setApplied(new Set());
    setErrors({});
    for (let i = 0; i < planIds.length; i += CHUNK) {
      const chunk = planIds.slice(i, i + CHUNK);
      try {
        const result = await checkPlanSplitsAction(chunk);
        setProposals((prev) => [...prev, ...result.proposals]);
        setUnchanged((prev) => prev + result.unchanged);
        setFailed((prev) => prev + result.failed);
      } catch {
        setFailed((prev) => prev + chunk.length);
      }
      setChecked((prev) => prev + chunk.length);
      if (i + CHUNK < planIds.length) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    setPhase("done");
  }

  async function apply(proposal: PlanSplitProposal): Promise<boolean> {
    setApplying(proposal.planId);
    const result = await applyPlanSplitAction(proposal.planId, proposal.headings).catch(() => ({
      error: "Non è stato possibile salvare la nuova divisione. Riprova.",
    }));
    setApplying(null);
    if (result.error) {
      setErrors((prev) => ({ ...prev, [proposal.planId]: result.error! }));
      return false;
    }
    setApplied((prev) => new Set(prev).add(proposal.planId));
    return true;
  }

  async function applyAll() {
    for (const proposal of proposals) {
      if (!applied.has(proposal.planId)) await apply(proposal);
    }
    router.refresh();
  }

  const pending = proposals.filter((p) => !applied.has(p.planId));

  return (
    <div
      className="rounded-2xl border border-primary/20 bg-primary-soft/50 p-4 sm:p-5"
      data-plan-split-check={single ? "single" : "all"}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[15px] font-bold leading-tight text-foreground">
            {single ? "Divisione in blocchi" : "Ricontrolla le schede con l'IA"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {single
              ? "Se un blocco contiene pezzi di altri blocchi, l'IA propone dove dividerlo. Il testo non cambia."
              : "L'IA rilegge le schede già salvate e propone dove dividere i blocchi quando non è giusto. Il testo non cambia e nulla viene salvato senza il tuo clic."}
          </p>
        </div>
        {phase !== "checking" && (
          <Button
            type="button"
            size="sm"
            variant={phase === "done" ? "outline" : "primary"}
            onClick={check}
            // Nella colonna stretta della singola scheda il pulsante va a capo sotto il testo.
            className={cn(single && "basis-full sm:basis-auto lg:basis-full")}
          >
            <Sparkles className="h-4 w-4" />
            {phase === "done"
              ? "Ricontrolla"
              : single
                ? "Ricontrolla con l'IA"
                : `Controlla ${planIds.length === 1 ? "la scheda" : `le ${planIds.length} schede`}`}
          </Button>
        )}
      </div>

      {phase === "checking" && (
        <div className="mt-4" role="status">
          <p className="text-sm font-semibold text-foreground">
            {single ? "L'IA sta rileggendo la scheda…" : `Controllo in corso: ${checked} di ${planIds.length}…`}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.max(8, (checked / Math.max(1, planIds.length)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground/80" role="status">
            {proposals.length === 0
              ? single
                ? "La divisione è già giusta: nulla da correggere."
                : "Tutte le schede sono già divise bene: nulla da correggere."
              : single
                ? "L'IA propone una divisione diversa."
                : `${proposals.length === 1 ? "1 scheda da correggere" : `${proposals.length} schede da correggere`}${
                    unchanged > 0 ? ` · ${unchanged} già giust${unchanged === 1 ? "a" : "e"}` : ""
                  }.`}
            {failed > 0 &&
              ` ${failed === 1 ? "Una scheda non è stata controllata" : `${failed} schede non sono state controllate`} (IA non disponibile): riprova più tardi.`}
          </p>

          {proposals.map((proposal) => {
            const done = applied.has(proposal.planId);
            return (
              <div
                key={proposal.planId}
                className="rounded-xl border border-border bg-card p-4 shadow-card"
                data-plan-split-proposal={proposal.planId}
              >
                {!single && (
                  <Link
                    href={`/admin/schede/${proposal.planId}`}
                    className="font-display text-[15px] font-bold text-foreground hover:text-primary"
                  >
                    {proposal.planTitle}
                  </Link>
                )}
                <div className={cn("grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start", !single && "mt-3")}>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                      Ora · {proposal.before.length} blocch{proposal.before.length === 1 ? "o" : "i"}
                    </p>
                    <BlockList blocks={proposal.before} tone="old" />
                  </div>
                  <ArrowRight className="hidden h-4 w-4 self-center text-muted-foreground sm:block" aria-hidden />
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-primary">
                      Con l&apos;IA · {proposal.after.length} blocch{proposal.after.length === 1 ? "o" : "i"}
                    </p>
                    <BlockList blocks={proposal.after} tone="new" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {done ? (
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                      <Check className="h-4 w-4" />
                      Nuova divisione salvata.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={applying !== null}
                      onClick={async () => {
                        if (await apply(proposal)) router.refresh();
                      }}
                    >
                      <Check className="h-4 w-4" />
                      {applying === proposal.planId ? "Salvo…" : "Applica"}
                    </Button>
                  )}
                  {errors[proposal.planId] && (
                    <p className="text-sm font-medium text-destructive">{errors[proposal.planId]}</p>
                  )}
                </div>
              </div>
            );
          })}

          {!single && pending.length > 1 && (
            <Button type="button" disabled={applying !== null} onClick={applyAll}>
              <Check className="h-4 w-4" />
              {applying ? "Salvo…" : `Applica a tutte (${pending.length})`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
