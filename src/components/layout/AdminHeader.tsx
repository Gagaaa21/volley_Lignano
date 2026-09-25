"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Puzzle,
  Shield,
  ShieldCheck,
  Swords,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/auth/actions";
import { enterTestModeAction } from "@/app/admin/test-mode/actions";
import { setActiveTeamAction } from "@/app/admin/actions";
import type { SessionPayload } from "@/lib/auth/session";
import { isPageAvailableForTeam, type AdminPage, type TrainingTeam } from "@/lib/types";
import { InstallButton } from "@/components/pwa/InstallButton";
import crest from "@/assets/lignano-crest.png";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; exact: boolean; page: AdminPage | null }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, page: null },
  { href: "/admin/allenamenti", label: "Allenamenti", icon: CalendarClock, exact: false, page: "allenamenti" },
  { href: "/admin/partite", label: "Partite", icon: Swords, exact: false, page: "partite" },
  { href: "/admin/schede", label: "Schede", icon: Puzzle, exact: false, page: "schede" },
  { href: "/admin/presenze", label: "Presenze", icon: ClipboardCheck, exact: false, page: "presenze" },
  { href: "/admin/staff", label: "Staff", icon: Users, exact: false, page: "staff" },
  { href: "/admin/guida", label: "Guida", icon: BookOpen, exact: false, page: "guida" },
];

const TEAM_OPTIONS: { value: TrainingTeam; label: string }[] = [
  { value: "u14u15", label: "U14/U15" },
  { value: "minivolley", label: "Minivolley" },
];

/** Sceglie la squadra attiva per tutta la sessione: Allenamenti, Partite,
 * Schede e Presenze mostrano da qui in poi i dati della squadra scelta.
 * Riporta sulla stessa pagina da cui è stato aperto, per non perdere il
 * punto in cui si era. Mostra solo le squadre che l'account può gestire
 * (Centro di controllo → Permessi): se ne resta solo una, lo switcher non
 * ha senso e sparisce del tutto. */
function TeamSwitcher({
  activeTeam,
  allowedTeams,
  pathname,
}: {
  activeTeam: TrainingTeam;
  allowedTeams: TrainingTeam[];
  pathname: string;
}) {
  const options = TEAM_OPTIONS.filter((option) => allowedTeams.includes(option.value));
  if (options.length < 2) return null;

  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border-subtle bg-surface p-0.5 shadow-sm shadow-sea-950/5"
      role="group"
      aria-label="Squadra attiva"
    >
      {options.map((option) => (
        <form key={option.value} action={setActiveTeamAction}>
          <input type="hidden" name="team" value={option.value} />
          <input type="hidden" name="redirectTo" value={pathname} />
          <button
            type="submit"
            disabled={activeTeam === option.value}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors",
              activeTeam === option.value
                ? "bg-sea-700 text-white"
                : "text-foreground/55 hover:bg-surface-muted",
            )}
          >
            {option.label}
          </button>
        </form>
      ))}
    </div>
  );
}

const DEV_NAV_ITEMS = [
  { href: "/admin/centro-controllo", label: "Centro di controllo", icon: Shield, exact: false },
  { href: "/admin/manutenzione", label: "Manutenzione", icon: Gauge, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: { href: string; label: string; icon: typeof LayoutDashboard };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link href={item.href} data-active={active ? "true" : undefined} onClick={onClick} className="nav-tile">
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function DevMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const devActive = DEV_NAV_ITEMS.some((item) => isActive(pathname, item.href, item.exact));

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden shrink-0 sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-active={devActive ? "true" : undefined}
        className="nav-tile"
      >
        <Shield className="h-4 w-4" />
        Developer
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Strumenti Developer"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-60 rounded-xl border border-border-subtle bg-card p-1.5 shadow-[0_20px_40px_-20px_rgba(9,27,38,0.4)]"
        >
          {DEV_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted font-semibold text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminHeader({
  session,
  allowedPages,
  allowedTeams,
  activeTeam,
}: {
  session: SessionPayload;
  allowedPages: AdminPage[];
  allowedTeams: TrainingTeam[];
  activeTeam: TrainingTeam;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.page && !isPageAvailableForTeam(item.page, activeTeam)) return false;
    if (session.role === "dev") return true;
    return !item.page || allowedPages.includes(item.page);
  });

  return (
    <header className="page-header">
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:space-y-4 sm:px-6 sm:py-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link href="/admin" className="brand-chip h-11 w-11 shrink-0 sm:h-12 sm:w-12">
            <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain" priority />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow truncate">Area tecnici</p>
            <h1 className="truncate font-display text-lg leading-tight tracking-tight sm:text-xl">
              Volley Lignano
            </h1>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span className="max-w-full truncate font-medium text-foreground/80">{session.fullName}</span>
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
              {session.role === "dev" && !session.testMode && (
                <form action={enterTestModeAction}>
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-u15-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-u15-strong)] transition-opacity hover:opacity-80"
                  >
                    <FlaskConical className="h-2.5 w-2.5" />
                    Modalità prova
                  </button>
                </form>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="hidden sm:block">
              <TeamSwitcher activeTeam={activeTeam} allowedTeams={allowedTeams} pathname={pathname} />
            </div>
            <InstallButton />
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
        </div>

        <div className="sm:hidden">
          <TeamSwitcher activeTeam={activeTeam} allowedTeams={allowedTeams} pathname={pathname} />
        </div>

        <div
          className={cn(
            "w-full items-center gap-2 sm:flex",
            mobileOpen ? "flex flex-col" : "hidden sm:flex",
          )}
        >
          <nav
            className="nav-rail scroll-fade-x w-full min-w-0 flex-1"
            data-mobile={mobileOpen ? "true" : undefined}
            aria-label="Sezioni area tecnici"
          >
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href, item.exact)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </nav>

          {session.role === "dev" && (
            <>
              <nav
                className="nav-rail w-full shrink-0 sm:hidden"
                data-mobile={mobileOpen ? "true" : undefined}
                aria-label="Strumenti Developer"
              >
                {DEV_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href, item.exact)}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
              <DevMenu pathname={pathname} />
            </>
          )}

          <div className="nav-cluster w-full shrink-0 sm:w-auto">
            <Link
              href={activeTeam === "minivolley" ? "/minivolley" : "/"}
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
