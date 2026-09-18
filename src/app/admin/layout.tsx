import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guard";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { isDemoMode } from "@/lib/db";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff();
  const demo = isDemoMode();

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted lg:flex-row">
      <AdminSidebar session={session} />
      <div className="flex-1">
        {demo && (
          <div className="bg-sand-400/90 px-4 py-2 text-center text-xs font-semibold text-sea-950 sm:text-sm">
            Modalità demo: dati salvati solo in memoria. Configura Supabase per l&apos;uso reale.
          </div>
        )}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
