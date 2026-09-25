import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveRepo } from "@/lib/db";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { BlockForm } from "../BlockForm";

export const metadata: Metadata = {
  title: "Modifica blocco",
};

export default async function EditBlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ planId?: string }>;
}) {
  const { id } = await params;
  const { planId } = await searchParams;
  const repo = await getActiveRepo();
  const block = await repo.getTrainingBlock(id);
  if (!block) notFound();

  const backHref = planId ? `/admin/schede/${planId}` : "/admin/schede/blocchi";

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href={backHref} variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        {planId ? "Torna alla scheda" : "Torna alla libreria"}
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica blocco</h1>
      <p className="mt-1 text-sm text-foreground/60">{block.title}</p>
      <p className="mt-1 text-xs text-foreground/45">
        Questo blocco è nella libreria condivisa: la modifica si applica in ogni scheda che lo usa.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <BlockForm block={block} planId={planId} />
        </CardBody>
      </Card>
    </div>
  );
}
