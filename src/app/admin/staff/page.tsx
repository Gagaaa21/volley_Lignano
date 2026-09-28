import type { Metadata } from "next";
import { EyeOff, Pencil, ShieldCheck, UserCog } from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_STAFF_STEPS } from "@/components/tour/sectionSteps";
import { StaffForm } from "./StaffForm";
import { deleteStaffAction } from "./actions";

export const metadata: Metadata = {
  title: "Staff",
};

export default async function StaffPage() {
  const session = await requireStaff();
  const repo = await getRepo();
  const staff = await repo.listStaff();
  // Un admin "nascosto" (impostabile solo dal Developer, vedi EditStaffForm)
  // non compare qui per gli altri Admin — il Developer vede comunque tutti.
  const visibleStaff = session.role === "dev" ? staff : staff.filter((m) => !m.hiddenFromAdmins);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Staff</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Crea nuovi account amministratore. Ogni admin riceve un nome utente e una password
            temporanea da cambiare al primo accesso.
          </p>
        </div>
        <SectionTour steps={SECTION_STAFF_STEPS} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="h-fit" data-tour="section-staff-form">
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

        <div className="space-y-3" data-tour="section-staff-list">
          {visibleStaff.map((member) => {
            const canManage = session.role === "dev" && member.role !== "dev" && member.id !== session.sub;
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
                      {/* Visibile solo al Developer: gli altri admin non
                       * vedono nemmeno questo account, figuriamoci il badge. */}
                      {session.role === "dev" && member.hiddenFromAdmins && (
                        <Badge className="bg-muted text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <EyeOff className="h-3 w-3" />
                            Nascosto
                          </span>
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/55">@{member.username}</p>
                    {member.mustChangePassword && (
                      <p className="mt-1 text-xs font-medium text-sand-700">
                        In attesa del primo accesso
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <LinkButton href={`/admin/staff/${member.id}`} variant="outline" size="sm" aria-label="Modifica">
                        <Pencil className="h-3.5 w-3.5" />
                      </LinkButton>
                      <form action={deleteStaffAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Rimuovere l'accesso di ${member.fullName} (@${member.username})?`}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/8"
                        >
                          Rimuovi
                        </ConfirmSubmitButton>
                      </form>
                    </div>
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
