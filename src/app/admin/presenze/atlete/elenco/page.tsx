import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { BulkAthleteForm } from "../BulkAthleteForm";

export const metadata: Metadata = {
  title: "Aggiungi atlete in elenco",
};

export default function BulkAthletesPage() {
  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/presenze/atlete" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle atlete
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Aggiungi atlete in elenco</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Incolla più nominativi insieme, uno per riga, invece di aggiungerli uno alla volta.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Elenco</h2>
        </CardHeader>
        <CardBody>
          <BulkAthleteForm />
        </CardBody>
      </Card>
    </div>
  );
}
