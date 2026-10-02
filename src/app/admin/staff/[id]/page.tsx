import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UserMinus } from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireDev } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { deleteStaffAction } from "../actions";
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
      <PageHeader
        back={{ href: "/admin/staff", label: "Staff" }}
        eyebrow="Modifica admin"
        title={member.fullName}
        description={`@${member.username}`}
      />

      <Card>
        <CardBody className="pt-6">
          <EditStaffForm member={member} />
        </CardBody>
      </Card>

      <section className="mt-8 flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">Rimuovi accesso</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">L&apos;account non potrà più entrare nell&apos;area tecnici.</p>
        </div>
        <form action={deleteStaffAction}>
          <input type="hidden" name="id" value={member.id} />
          <ConfirmSubmitButton
            confirmMessage={`Rimuovere l'accesso di ${member.fullName} (@${member.username})?`}
            variant="danger"
            size="sm"
          >
            <UserMinus className="h-4 w-4" />
            Rimuovi
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
