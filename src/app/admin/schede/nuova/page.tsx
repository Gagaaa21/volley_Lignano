import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanCreateForm } from "../PlanCreateForm";

export const metadata: Metadata = {
  title: "Nuova scheda",
};

// La divisione in blocchi con l'IA (con modelli di riserva) può richiedere
// qualche decina di secondi: 60 secondi restano entro il limite di ogni piano Vercel.
export const maxDuration = 60;

export default async function NewTrainingPlanPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: "/admin/schede", label: "Schede" }}
        title="Nuova scheda"
        description="Incolla l'allenamento così come lo scrivi di solito: verrà diviso automaticamente in blocchi."
      />
      <Card>
        <CardBody className="pt-6 sm:pt-7">
          <PlanCreateForm />
        </CardBody>
      </Card>
    </div>
  );
}
