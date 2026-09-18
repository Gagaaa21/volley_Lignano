"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutDashboard, LogOut, Swords, Users, Volleyball } from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionPayload } from "@/lib/auth/session";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/allenamenti", label: "Allenamenti", icon: CalendarClock, exact: false },
  { href: "/admin/partite", label: "Partite", icon: Swords, exact: false },
  { href: "/admin/staff", label: "Staff", icon: Users, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors shrink-0",
              active
                ? "bg-sea-700 text-white shadow-sm shadow-sea-900/30"
                : "text-sea-50/80 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminSidebar({ session }: { session: SessionPayload }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:flex-col lg:bg-sea-900 lg:text-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sand-400 to-sand-600 text-sea-950">
            <Volleyball className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold">Volley Lignano</p>
            <p className="text-[11px] uppercase tracking-wider text-sea-200">Area riservata</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          <NavLinks pathname={pathname} />
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-3 rounded-xl bg-white/5 px-3.5 py-3">
            <p className="truncate text-sm font-semibold text-white">{session.fullName}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-sand-400/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sea-950">
              {session.role === "dev" ? "Developer" : "Admin"}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sea-100/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4.5 w-4.5" strokeWidth={2.1} />
              Esci
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex flex-col bg-sea-900 text-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sand-400 to-sand-600 text-sea-950">
              <Volleyball className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <p className="font-display text-sm font-bold">Volley Lignano</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Esci"
              className="flex h-9 w-9 items-center justify-center rounded-full text-sea-100/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4.5 w-4.5" strokeWidth={2.1} />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          <NavLinks pathname={pathname} />
        </nav>
      </div>
    </>
  );
}
