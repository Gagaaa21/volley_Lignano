import type { ReactNode } from "react";
import { FlaskConical, LogOut } from "lucide-react";
import { requireStaff, activeTeam, getOwnStaff } from "@/lib/auth/guard";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { isDemoMode } from "@/lib/db";
import { exitTestModeAction } from "@/app/admin/test-mode/actions";
import { ADMIN_PAGES, TEAMS } from "@/lib/types";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff();
  const demo = isDemoMode();

  let allowedPages = ADMIN_PAGES;
  let allowedTeams = TEAMS;
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    allowedPages = staff?.allowedPages ?? [];
    allowedTeams = staff?.allowedTeams ?? TEAMS;
  }

  // Se la squadra scelta nello switcher non è (più) tra quelle permesse
  // (es. il Developer ha appena tolto l'accesso al Minivolley, ma il
  // cookie di sessione la ricorda ancora), ricade sulla prima permessa.
  const requestedTeam = activeTeam(session);
  const team = allowedTeams.includes(requestedTeam) ? requestedTeam : (allowedTeams[0] ?? "u14u15");

  return (
    <div className="app-surface flex min-h-screen flex-col">
      <AdminHeader session={session} allowedPages={allowedPages} allowedTeams={allowedTeams} activeTeam={team} />
      {session.testMode && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-[var(--color-u15)] px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" />
            Modalità prova: stai lavorando su una copia dei dati. Niente notifiche, nessuna modifica
            verrà salvata.
          </span>
          <form action={exitTestModeAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold transition-colors hover:bg-white/25"
            >
              <LogOut className="h-3 w-3" />
              Esci dalla modalità prova
            </button>
          </form>
        </div>
      )}
      {demo && (
        <div className="bg-sand-400/90 px-4 py-2 text-center text-xs font-semibold text-sea-950 sm:text-sm">
          Modalità demo: dati salvati solo in memoria. Configura Supabase per l&apos;uso reale.
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
