import type { Metadata } from "next";
import { UserCog } from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SectionTour } from "@/components/tour/SectionTour";
import { SECTION_STAFF_STEPS } from "@/components/tour/sectionSteps";
import { StaffForm } from "./StaffForm";
import { StaffMemberList } from "./StaffMemberList";

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
  // StaffMemberList è "use client": passwordHash non deve mai finire nel
  // payload RSC inviato al browser, anche solo per un campo mai renderizzato.
  const publicStaff = visibleStaff.map((m) => ({
    id: m.id,
    username: m.username,
    fullName: m.fullName,
    role: m.role,
    mustChangePassword: m.mustChangePassword,
    hasSeenGuide: m.hasSeenGuide,
    allowedPages: m.allowedPages,
    allowedTeams: m.allowedTeams,
    hiddenFromAdmins: m.hiddenFromAdmins,
    createdBy: m.createdBy,
    createdAt: m.createdAt,
  }));

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

        <StaffMemberList staff={publicStaff} currentUserId={session.sub} isDev={session.role === "dev"} />
      </div>
    </div>
  );
}
