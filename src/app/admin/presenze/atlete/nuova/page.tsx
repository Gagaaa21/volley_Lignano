import type { Metadata } from "next";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AthleteForm } from "../AthleteForm";

export const metadata: Metadata = {
  title: "Nuova atleta",
};

export default async function NewAthletePage() {
  const team = await resolveActiveTeam(await requireStaff());
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/admin/presenze/atlete", label: "Atlete" }}
        title="Nuova atleta"
        description="Entra nell'anagrafica usata per il registro presenze."
      />
      <Card>
        <CardBody className="pt-6">
          <AthleteForm team={team} />
        </CardBody>
      </Card>
    </div>
  );
}
