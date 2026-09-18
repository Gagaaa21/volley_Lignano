import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guard";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { isDemoMode } from "@/lib/db";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaff();
  const demo = isDemoMode();

  return (
    <div className="app-surface flex min-h-screen flex-col">
      <AdminHeader session={session} />
      {demo && (
        <div className="bg-sand-400/90 px-4 py-2 text-center text-xs font-semibold text-sea-950 sm:text-sm">
          Modalità demo: dati salvati solo in memoria. Configura Supabase per l&apos;uso reale.
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
