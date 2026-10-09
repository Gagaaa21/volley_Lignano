"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Puzzle,
  Shield,
  Swords,
  Target,
  Users,
  Volleyball,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/auth/actions";
import { enterTestModeAction } from "@/app/admin/test-mode/actions";
import { setActiveTeamAction } from "@/app/admin/actions";
import type { SessionPayload } from "@/lib/auth/session";
import { isPageAvailableForTeam, type AdminPage, type TrainingTeam } from "@/lib/types";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ThemeSegmented } from "@/components/theme/ThemeSwitcher";
import { Avatar } from "@/components/ui/Avatar";
import crest from "@/assets/lignano-crest.png";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  page: AdminPage | null;
  tourId?: string;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, page: null },
  { href: "/admin/allenamenti", label: "Allenamenti", icon: CalendarClock, exact: false, page: "allenamenti", tourId: "nav-allenamenti" },
  { href: "/admin/partite", label: "Partite", icon: Swords, exact: false, page: "partite", tourId: "nav-partite" },
  { href: "/admin/schede", label: "Schede", icon: Puzzle, exact: false, page: "schede", tourId: "nav-schede" },
  { href: "/admin/presenze", label: "Presenze", icon: ClipboardCheck, exact: false, page: "presenze", tourId: "nav-presenze" },
  { href: "/admin/test-fisici", label: "Test fisici", icon: Activity, exact: false, page: "testfisici", tourId: "nav-test-fisici" },
  { href: "/admin/livescore", label: "Live score", icon: Volleyball, exact: false, page: "livescore", tourId: "nav-livescore" },
  { href: "/admin/pronostici", label: "Pronostici", icon: Target, exact: false, page: "pronostici", tourId: "nav-pronostici" },
  { href: "/admin/staff", label: "Staff", icon: Users, exact: false, page: "staff", tourId: "nav-staff" },
  { href: "/admin/guida", label: "Guida", icon: BookOpen, exact: false, page: "guida", tourId: "nav-guida" },
];

const DEV_NAV_ITEMS = [
  { href: "/admin/centro-controllo", label: "Centro di controllo", icon: Shield, tourId: "nav-centro-controllo" },
  { href: "/admin/manutenzione", label: "Manutenzione", icon: Gauge, tourId: "nav-manutenzione" },
];

const TEAM_OPTIONS: { value: TrainingTeam; label: string }[] = [
  { value: "u14u15", label: "U14/U15" },
  { value: "minivolley", label: "Minivolley" },
];

function isActive(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

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
      className="inline-flex shrink-0 items-center gap-0.5 rounded-xl bg-muted p-1"
      role="group"
      aria-label="Squadra attiva"
      data-tour="team-switcher"
    >
      {options.map((option) => {
        const active = activeTeam === option.value;
        return (
          <form key={option.value} action={setActiveTeamAction}>
            <input type="hidden" name="team" value={option.value} />
            <input type="hidden" name="redirectTo" value={pathname} />
            <button
              type="submit"
              disabled={active}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-bold tracking-[0.01em] transition-colors sm:px-3",
                active
                  ? "bg-surface text-primary shadow-[0_1px_2px_rgba(15,30,50,0.1),0_0_0_1px_rgba(15,30,50,0.04)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          </form>
        );
      })}
    </div>
  );
}

/** Menu dell'account: identità e ruolo, strumenti Developer, modalità prova,
 * sito pubblico, password ed uscita — tutto ciò che prima affollava l'header
 * in pillole separate. Marcato `dev-menu-toggle` per il tour guidato, che lo
 * apre da solo quando deve evidenziare una voce al suo interno. */
function UserMenu({ session, activeTeam }: { session: SessionPayload; activeTeam: TrainingTeam }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isDev = session.role === "dev";
  const devActive = DEV_NAV_ITEMS.some((item) => pathname.startsWith(item.href));

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

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu account"
        data-tour="dev-menu-toggle"
        className={cn(
          "flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-muted sm:pr-2.5",
          (open || devActive) && "bg-muted",
        )}
      >
        <Avatar name={session.fullName} size="sm" tone={isDev ? "gold" : "primary"} />
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-foreground sm:block">
          {session.fullName}
        </span>
        <ChevronDown
          className={cn("hidden h-4 w-4 text-muted-foreground transition-transform sm:block", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 origin-top-right animate-[pop-in_140ms_ease-out] rounded-2xl border border-border bg-popover p-1.5 shadow-pop"
        >
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <Avatar name={session.fullName} size="md" tone={isDev ? "gold" : "primary"} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{session.fullName}</p>
              <p className="text-xs font-medium text-muted-foreground">{isDev ? "Developer" : "Admin"}</p>
            </div>
          </div>

          {isDev && (
            <div className="border-t border-border py-1.5">
              <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Developer
              </p>
              {DEV_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    data-tour={item.tourId}
                    onClick={() => setOpen(false)}
                    className={cn(itemClass, active && "bg-primary-soft text-primary")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              {!session.testMode && (
                <form action={enterTestModeAction}>
                  <button type="submit" role="menuitem" data-tour="test-mode-toggle" className={itemClass}>
                    <FlaskConical className="h-4 w-4 text-[var(--color-u15)]" />
                    Modalità prova
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="border-t border-border px-1 py-2">
            <p className="px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tema
            </p>
            <ThemeSegmented />
          </div>

          <div className="border-t border-border pt-1.5">
            <Link
              href={activeTeam === "minivolley" ? "/minivolley" : "/"}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Globe className="h-4 w-4" />
              Sito pubblico
            </Link>
            <Link href="/admin/cambia-password" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <KeyRound className="h-4 w-4" />
              Cambia password
            </Link>
            <form action={logoutAction}>
              <button type="submit" role="menuitem" className={cn(itemClass, "text-destructive hover:bg-destructive/8 hover:text-destructive")}>
                <LogOut className="h-4 w-4" />
                Esci
              </button>
            </form>
          </div>
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
  const navRef = useRef<HTMLElement>(null);
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.page && !isPageAvailableForTeam(item.page, activeTeam)) return false;
    if (session.role === "dev") return true;
    return !item.page || allowedPages.includes(item.page);
  });

  // Su schermi stretti la barra delle sezioni scorre in orizzontale: porta
  // in vista la sezione attiva invece di lasciarla eventualmente nascosta
  // oltre il bordo destro.
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <header className="page-header">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/admin" className="flex min-w-0 items-center gap-3">
          <span className="brand-chip h-10 w-10 shrink-0">
            <Image src={crest} alt="Stemma Volley Lignano" className="h-full w-full object-contain p-0.5" priority />
          </span>
          <span className="hidden min-w-0 leading-tight min-[480px]:block">
            <span className="block truncate font-display text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
              Volley Lignano
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Area tecnici
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
          <TeamSwitcher activeTeam={activeTeam} allowedTeams={allowedTeams} pathname={pathname} />
          <InstallButton />
          <UserMenu session={session} activeTeam={activeTeam} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-2 sm:px-4">
        <nav
          ref={navRef}
          aria-label="Sezioni area tecnici"
          className="no-scrollbar scroll-fade-x flex items-stretch gap-0.5 overflow-x-auto pr-6"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tourId}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1.5 text-sm font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-foreground/40 group-hover:text-foreground/70")} />
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-[3px] rounded-t-full transition-colors",
                    active ? "bg-primary" : "bg-transparent group-hover:bg-border-strong",
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
