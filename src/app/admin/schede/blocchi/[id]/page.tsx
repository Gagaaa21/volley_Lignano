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

export default async function EditBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getActiveRepo();
  const block = await repo.getTrainingBlock(id);
  if (!block) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/schede/blocchi" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alla libreria
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica blocco</h1>
      <p className="mt-1 text-sm text-foreground/60">{block.title}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <BlockForm block={block} />
        </CardBody>
      </Card>
    </div>
  );
}
