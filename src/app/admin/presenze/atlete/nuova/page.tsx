import type { Metadata } from "next";
import { getActiveRepo } from "@/lib/db";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AthleteForm } from "../AthleteForm";
import { takenJerseys } from "../taken";

export const metadata: Metadata = {
  title: "Nuova atleta",
};

export default async function NewAthletePage() {
  const team = await resolveActiveTeam(await requireStaff());
  const taken = takenJerseys(await (await getActiveRepo()).listAthletes({ team }));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/admin/presenze/atlete", label: "Atlete" }}
        title="Nuova atleta"
        description="Entra nell'anagrafica usata per il registro presenze."
      />
      <Card>
        <CardBody className="pt-6">
          <AthleteForm team={team} taken={taken} />
        </CardBody>
      </Card>
    </div>
  );
}
