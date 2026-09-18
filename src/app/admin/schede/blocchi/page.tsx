import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock, Pencil, Plus, Puzzle } from "lucide-react";
import { getRepo } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { BlockContent } from "@/components/schede/BlockContent";
import { deleteBlockAction } from "./actions";

export const metadata: Metadata = {
  title: "Libreria blocchi",
};

export default async function BlocksLibraryPage() {
  const repo = await getRepo();
  const [blocks, plans] = await Promise.all([repo.listTrainingBlocks(), repo.listTrainingPlans()]);

  const usageCount = new Map<string, number>();
  for (const plan of plans) {
    for (const blockId of plan.blockIds) {
      usageCount.set(blockId, (usageCount.get(blockId) ?? 0) + 1);
    }
  }

  return (
    <div>
      <Link
        href="/admin/schede"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-sea-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Torna alle schede
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Puzzle className="h-6 w-6 text-sea-700" />
            Libreria blocchi
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            I blocchi sono riutilizzabili: modificane uno qui e l&apos;aggiornamento si riflette in
            tutte le schede che lo usano.
          </p>
        </div>
        <LinkButton href="/admin/schede/blocchi/nuovo">
          <Plus className="h-4 w-4" />
          Nuovo blocco
        </LinkButton>
      </div>

      {blocks.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessun blocco in libreria. Crea il primo blocco oppure importa un intero allenamento da
          una scheda.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {blocks.map((block) => {
            const uses = usageCount.get(block.id) ?? 0;
            return (
              <Card key={block.id}>
                <CardBody className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-base font-bold text-foreground">{block.title}</h2>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-training-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-training-strong)]">
                      <Clock className="h-3 w-3" />
                      {block.durationMinutes}&apos;
                    </span>
                  </div>

                  <BlockContent content={block.content} className="mt-3 line-clamp-4" />

                  <p className="mt-3 text-xs text-foreground/45">
                    {uses === 0
                      ? "Non usato in nessuna scheda"
                      : `Usato in ${uses} scheda${uses > 1 ? "e" : ""}`}
                  </p>

                  <div className="mt-4 flex items-center gap-2 border-t border-border-subtle pt-4">
                    <LinkButton
                      href={`/admin/schede/blocchi/${block.id}`}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifica
                    </LinkButton>
                    <form action={deleteBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <ConfirmSubmitButton
                        confirmMessage={
                          uses > 0
                            ? `"${block.title}" è usato in ${uses} scheda${uses > 1 ? "e" : ""}. Eliminarlo lo rimuoverà anche da lì. Continuare?`
                            : `Eliminare il blocco "${block.title}"?`
                        }
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        Elimina
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
