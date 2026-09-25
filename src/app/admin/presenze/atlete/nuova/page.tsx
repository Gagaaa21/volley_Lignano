import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireStaff, requireU14U15Team } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AthleteForm } from "../AthleteForm";

export const metadata: Metadata = {
  title: "Nuova atleta",
};

export default async function NewAthletePage() {
  await requireU14U15Team(await requireStaff());
  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/presenze/atlete" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle atlete
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Nuova atleta</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Entra nell&apos;anagrafica usata per il registro presenze.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Dettagli</h2>
        </CardHeader>
        <CardBody>
          <AthleteForm />
        </CardBody>
      </Card>
    </div>
  );
}
