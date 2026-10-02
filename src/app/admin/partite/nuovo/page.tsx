import type { Metadata } from "next";
import { requireStaff, resolveActiveTeam } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MatchForm } from "../MatchForm";

export const metadata: Metadata = {
  title: "Nuova partita",
};

export default async function NewMatchPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/admin/partite", label: "Partite" }}
        title="Nuova partita"
        description="Aggiungi una partita al calendario pubblico."
      />
      <Card>
        <CardBody className="pt-6 sm:pt-7">
          <MatchForm team={team} />
        </CardBody>
      </Card>
    </div>
  );
}
