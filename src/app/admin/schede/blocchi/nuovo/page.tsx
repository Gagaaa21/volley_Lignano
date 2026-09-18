import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { BlockForm } from "../BlockForm";

export const metadata: Metadata = {
  title: "Nuovo blocco",
};

export default async function NewBlockPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const { planId } = await searchParams;
  const backHref = planId ? `/admin/schede/${planId}` : "/admin/schede/blocchi";

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href={backHref} variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna indietro
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuovo blocco</h1>
      <p className="mt-1 text-sm text-foreground/60">
        {planId
          ? "Il blocco verrà aggiunto automaticamente alla scheda in corso."
          : "Il blocco entra nella libreria riutilizzabile."}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <BlockForm planId={planId} />
        </CardBody>
      </Card>
    </div>
  );
}
