import type { Metadata } from "next";
import { ShieldCheck, UserCog } from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { StaffForm } from "./StaffForm";
import { deleteStaffAction } from "./actions";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function StaffPage() {
  const session = await requireStaff();
  const repo = await getRepo();
  const staff = await repo.listStaff();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Staff</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Crea nuovi account amministratore. Ogni admin riceve un nome utente e una password
        temporanea da cambiare al primo accesso.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <UserCog className="h-4 w-4 text-sea-700" />
              Nuovo account admin
            </h2>
          </CardHeader>
          <CardBody>
            <StaffForm />
          </CardBody>
        </Card>

        <div className="space-y-3">
          {staff.map((member) => {
            const canDelete = session.role === "dev" && member.role !== "dev" && member.id !== session.sub;
            return (
              <Card key={member.id}>
                <CardBody className="flex items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{member.fullName}</p>
                      <Badge
                        className={
                          member.role === "dev"
                            ? "bg-sand-200 text-sand-800"
                            : "bg-sea-100 text-sea-700"
                        }
                      >
                        {member.role === "dev" ? (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Developer
                          </span>
                        ) : (
                          "Admin"
                        )}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/55">@{member.username}</p>
                    {member.mustChangePassword && (
                      <p className="mt-1 text-xs font-medium text-sand-700">
                        In attesa del primo accesso
                      </p>
                    )}
                  </div>

                  {canDelete && (
                    <form action={deleteStaffAction}>
                      <input type="hidden" name="id" value={member.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Rimuovere l'accesso di ${member.fullName} (@${member.username})?`}
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-600 hover:bg-red-50"
                      >
                        Rimuovi
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
