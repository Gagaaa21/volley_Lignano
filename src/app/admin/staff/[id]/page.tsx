import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EditStaffForm } from "../EditStaffForm";

export const metadata: Metadata = {
  title: "Modifica admin",
};

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDev();
  const { id } = await params;
  const repo = await getRepo();
  const member = await repo.getStaffById(id);
  if (!member) notFound();
  if (member.role === "dev") redirect("/admin/staff");

  return (
    <div className="mx-auto max-w-xl">
      <LinkButton href="/admin/staff" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna allo staff
      </LinkButton>

      <h1 className="font-display text-2xl font-bold text-foreground">Modifica admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">{member.fullName}</p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Credenziali</h2>
        </CardHeader>
        <CardBody>
          <EditStaffForm member={member} />
        </CardBody>
      </Card>
    </div>
  );
}
