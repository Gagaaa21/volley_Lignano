import type { Metadata } from "next";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
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
      <PageHeader
        title="Staff"
        description="Gli account che accedono all'area tecnici. Ogni nuovo admin riceve una password temporanea da cambiare al primo accesso."
        help={<SectionTour steps={SECTION_STAFF_STEPS} />}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
        <section className="min-w-0">
          <SectionHeading
            title="Account"
            action={<span className="text-[13px] text-muted-foreground">{publicStaff.length}</span>}
          />
          <StaffMemberList staff={publicStaff} currentUserId={session.sub} isDev={session.role === "dev"} />
        </section>

        <section data-tour="section-staff-form">
          <SectionHeading title="Nuovo account admin" />
          <Card>
            <CardBody className="pt-5 sm:pt-6">
              <StaffForm />
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  );
}
