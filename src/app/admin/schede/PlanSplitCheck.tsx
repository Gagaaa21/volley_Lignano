"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, Check, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  applyPlanSplitAction,
  checkPlanSplitsAction,
  type PlanSplitFailure,
  type PlanSplitProposal,
} from "./resplit-actions";

/** Schede mandate al server per ogni richiesta (ognuna è una chiamata all'IA). */
const CHUNK = 2;
/** Pausa tra una richiesta e l'altra: l'IA gratuita accetta poche richieste al minuto. */
const PAUSE_MS = 1500;
/** Nomi delle schede non controllate mostrati per esteso: oltre, "…e altre N". */
const MAX_FAILURES_LISTED = 6;

interface PlanRef {
  id: string;
  title: string;
}

function durationLabel(minutes: number): string {
  return minutes > 0 ? `${minutes}'` : "—";
}

function BlockList({ blocks, tone }: { blocks: { title: string; durationMinutes: number }[]; tone: "old" | "new" }) {
  return (
    <ol className="space-y-1">
      {blocks.map((block, i) => (
        <li key={i} className="flex items-baseline gap-2 text-sm">
          <span className="tabular w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">{i + 1}.</span>
          <span
            className={cn("min-w-0 flex-1 break-words", tone === "old" ? "text-foreground/70" : "font-semibold text-foreground")}
          >
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

/** Cosa dire quando alcune schede non sono state controllate: il motivo più utile da sapere. */
function failureExplanation(failures: PlanSplitFailure[]): string {
  if (failures.some((f) => f.reason === "quota")) {
    return "L'IA gratuita ha finito le richieste che può fare oggi: si rinnovano col tempo. Riprova più tardi o domani.";
  }
  if (failures.some((f) => f.reason === "unavailable")) {
    return "L'IA non ha risposto (a volte è sovraccarica): riprova tra qualche minuto.";
  }
  return "L'IA ha risposto con una divisione che non corrisponde al testo della scheda: riprova.";
}

/**
 * Ricontrolla con l'IA la divisione in blocchi delle schede già salvate e
 * propone le correzioni: il testo dei blocchi non cambia, cambia solo dove
 * inizia ogni blocco. Ogni proposta si applica con un clic. Le schede che l'IA
 * non riesce a controllare vengono elencate, e si possono riprovare da sole.
 */
export function PlanSplitCheck({ plans, single = false }: { plans: PlanRef[]; single?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "checking" | "done">("idle");
  const [checked, setChecked] = useState(0);
  const [total, setTotal] = useState(plans.length);
  const [proposals, setProposals] = useState<PlanSplitProposal[]>([]);
  const [unchanged, setUnchanged] = useState(0);
  const [failures, setFailures] = useState<PlanSplitFailure[]>([]);
  /** Schede salvate con la nuova divisione, con il numero di blocchi che hanno ora. */
  const [applied, setApplied] = useState<Map<string, number>>(new Map());
  const [applying, setApplying] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Controlla le schede indicate; con `fresh` riparte da zero, altrimenti aggiunge ai risultati già ottenuti. */
  async function run(targets: PlanRef[], fresh: boolean) {
    setPhase("checking");
    setChecked(0);
    setTotal(targets.length);
    setFailures([]);
    if (fresh) {
      setProposals([]);
      setUnchanged(0);
      setApplied(new Map());
      setErrors({});
    }
    const notChecked: PlanSplitFailure[] = [];
    for (let i = 0; i < targets.length; i += CHUNK) {
      const chunk = targets.slice(i, i + CHUNK);
      try {
        const result = await checkPlanSplitsAction(chunk.map((plan) => plan.id));
        setProposals((prev) => [...prev, ...result.proposals]);
        setUnchanged((prev) => prev + result.unchanged);
        notChecked.push(...result.failures);
        // Il limite di richieste vale per tutte le schede: inutile insistere con le altre.
        if (result.failures.some((f) => f.reason === "quota")) {
          for (const plan of targets.slice(i + CHUNK)) {
            notChecked.push({ planId: plan.id, planTitle: plan.title, reason: "quota" });
          }
          setChecked(targets.length);
          break;
        }
      } catch {
        for (const plan of chunk) notChecked.push({ planId: plan.id, planTitle: plan.title, reason: "unavailable" });
      }
      setChecked((prev) => prev + chunk.length);
      if (i + CHUNK < targets.length) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
    setFailures(notChecked);
    setPhase("done");
  }

  function retryFailed() {
    const ids = new Set(failures.map((f) => f.planId));
    void run(
      plans.filter((plan) => ids.has(plan.id)),
      false,
    );
  }

  async function apply(proposal: PlanSplitProposal): Promise<boolean> {
    setApplying(proposal.planId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[proposal.planId];
      return next;
    });
    const result = await applyPlanSplitAction(proposal.planId, proposal.headings).catch(() => ({
      error: "Non è stato possibile salvare la nuova divisione. Riprova.",
      blockCount: undefined,
    }));
    setApplying(null);
    if (result.error) {
      setErrors((prev) => ({ ...prev, [proposal.planId]: result.error! }));
      return false;
    }
    setApplied((prev) => new Map(prev).set(proposal.planId, result.blockCount ?? proposal.after.length));
    return true;
  }

  async function applyAll() {
    for (const proposal of proposals) {
      if (!applied.has(proposal.planId)) await apply(proposal);
    }
    router.refresh();
  }

  const pending = proposals.filter((p) => !applied.has(p.planId));

  const summary =
    proposals.length > 0
      ? single
        ? "L'IA propone una divisione diversa."
        : `${proposals.length === 1 ? "1 scheda da correggere" : `${proposals.length} schede da correggere`}${
            unchanged > 0 ? ` · ${unchanged} già giust${unchanged === 1 ? "a" : "e"}` : ""
          }.`
      : failures.length > 0
        ? unchanged > 0
          ? `${unchanged} ${unchanged === 1 ? "scheda già giusta" : "schede già giuste"}.`
          : null
        : single
          ? "La divisione è già giusta: nulla da correggere."
          : "Tutte le schede sono già divise bene: nulla da correggere.";

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
            onClick={() => void run(plans, true)}
            // Nella colonna stretta della singola scheda il pulsante va a capo sotto il testo.
            className={cn(single && "basis-full sm:basis-auto lg:basis-full")}
          >
            <Sparkles className="h-4 w-4" />
            {phase === "done"
              ? "Ricontrolla"
              : single
                ? "Ricontrolla con l'IA"
                : `Controlla ${plans.length === 1 ? "la scheda" : `le ${plans.length} schede`}`}
          </Button>
        )}
      </div>

      {phase === "checking" && (
        <div className="mt-4" role="status">
          <p className="text-sm font-semibold text-foreground">
            {single ? "L'IA sta rileggendo la scheda…" : `Controllo in corso: ${checked} di ${total}…`}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.max(8, (checked / Math.max(1, total)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-4 space-y-3">
          {summary && (
            <p className="text-sm text-foreground/80" role="status">
              {summary}
            </p>
          )}

          {failures.length > 0 && (
            <div className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-foreground" data-plan-split-failures>
              <p className="font-semibold text-warning">
                {single
                  ? "L'IA non ha potuto controllare la scheda."
                  : failures.length === 1
                    ? "Una scheda non è stata controllata:"
                    : `${failures.length} schede non sono state controllate:`}
              </p>
              {!single && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {failures.slice(0, MAX_FAILURES_LISTED).map((f) => (
                    <li key={f.planId}>{f.planTitle}</li>
                  ))}
                  {failures.length > MAX_FAILURES_LISTED && (
                    <li className="list-none text-muted-foreground">
                      …e altre {failures.length - MAX_FAILURES_LISTED}
                    </li>
                  )}
                </ul>
              )}
              <p className="mt-1.5 text-foreground/80">{failureExplanation(failures)}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2.5" onClick={retryFailed}>
                <RotateCw className="h-4 w-4" />
                {single || failures.length === 1 ? "Riprova" : `Riprova le ${failures.length} non controllate`}
              </Button>
            </div>
          )}

          {proposals.map((proposal) => {
            const savedBlocks = applied.get(proposal.planId);
            return (
              // @container: sotto i 28rem di larghezza (colonna stretta) le due divisioni vanno una sopra l'altra.
              <div
                key={proposal.planId}
                className="@container rounded-xl border border-border bg-card p-4 shadow-card"
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
                <div
                  className={cn(
                    "grid gap-3 @md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] @md:items-start @md:gap-4",
                    !single && "mt-3",
                  )}
                >
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                      Ora · {proposal.before.length} blocch{proposal.before.length === 1 ? "o" : "i"}
                    </p>
                    <BlockList blocks={proposal.before} tone="old" />
                  </div>
                  <ArrowRight className="hidden h-4 w-4 self-center text-muted-foreground @md:block" aria-hidden />
                  <ArrowDown className="h-4 w-4 text-muted-foreground @md:hidden" aria-hidden />
                  <div className="min-w-0">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-primary">
                      Con l&apos;IA · {proposal.after.length} blocch{proposal.after.length === 1 ? "o" : "i"}
                    </p>
                    <BlockList blocks={proposal.after} tone="new" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {savedBlocks !== undefined ? (
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                      <Check className="h-4 w-4" />
                      Salvata: ora la scheda ha {savedBlocks} blocch{savedBlocks === 1 ? "o" : "i"}.
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
                    <p className="text-sm font-medium text-destructive" role="alert">
                      {errors[proposal.planId]}
                    </p>
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
