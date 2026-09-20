"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Puzzle,
  ShieldCheck,
  Swords,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionPayload } from "@/lib/auth/session";
import { InstallButton } from "@/components/pwa/InstallButton";
import crest from "@/assets/lignano-crest.png";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/allenamenti", label: "Allenamenti", icon: CalendarClock, exact: false },
  { href: "/admin/partite", label: "Partite", icon: Swords, exact: false },
  { href: "/admin/schede", label: "Schede", icon: Puzzle, exact: false },
  { href: "/admin/presenze", label: "Presenze", icon: ClipboardCheck, exact: false },
  { href: "/admin/staff", label: "Staff", icon: Users, exact: false },
  { href: "/admin/guida", label: "Guida", icon: BookOpen, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function AdminHeader({ session }: { session: SessionPayload }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="page-header">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:space-y-4 sm:px-6 sm:py-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link href="/admin" className="brand-chip h-11 w-11 shrink-0 sm:h-12 sm:w-12">
            <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow truncate">Area riservata</p>
            <h1 className="truncate font-display text-lg leading-tight tracking-tight sm:text-xl">
              Volley Lignano
            </h1>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground/80">{session.fullName}</span>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                  session.role === "dev"
                    ? "bg-sand-100 text-sand-800 ring-sand-300"
                    : "bg-primary/10 text-primary ring-primary/25",
                )}
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                {session.role === "dev" ? "Developer" : "Admin"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Chiudi menu" : "Apri menu"}
            className="nav-tile shrink-0 sm:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            {mobileOpen ? "Chiudi" : "Menu"}
          </button>
        </div>

        <div
          className={cn(
            "w-full items-center gap-2 sm:flex",
            mobileOpen ? "flex flex-col" : "hidden sm:flex",
          )}
        >
          <nav
            className="nav-rail w-full min-w-0 flex-1"
            data-mobile={mobileOpen ? "true" : undefined}
            aria-label="Sezioni area riservata"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active ? "true" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="nav-tile"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="nav-cluster w-full shrink-0 sm:w-auto">
            <InstallButton variant="nav-tile" />
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="nav-tile w-full sm:w-auto"
              aria-label="Vai al sito pubblico"
            >
              <Globe className="h-4 w-4" />
              Sito pubblico
            </Link>
            <form action={logoutAction} className="w-full sm:w-auto">
              <button type="submit" className="nav-tile w-full sm:w-auto" aria-label="Esci">
                <LogOut className="h-4 w-4" />
                Esci
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
