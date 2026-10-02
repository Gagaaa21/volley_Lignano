import type { Metadata } from "next";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { BulkAthleteForm } from "../BulkAthleteForm";

export const metadata: Metadata = {
  title: "Aggiungi atlete in elenco",
};

export default async function BulkAthletesPage() {
  const team = await resolveActiveTeam(await requireStaff());
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/admin/presenze/atlete", label: "Atlete" }}
        title="Aggiungi atlete in elenco"
        description="Incolla più nominativi insieme, uno per riga, invece di aggiungerli uno alla volta."
      />
      <Card>
        <CardBody className="pt-6">
          <BulkAthleteForm team={team} />
        </CardBody>
      </Card>
    </div>
  );
}
