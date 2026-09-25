import { LogIn } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/LinkButton";
import { InstallButton } from "@/components/pwa/InstallButton";
import type { TrainingTeam } from "@/lib/types";

/** Header dei siti pubblici: U14/U15 e Minivolley sono due siti distinti di
 * proposito (loghi e pagine separati), senza collegamento diretto tra loro
 * qui. Chi passa da uno all'altro è lo staff dall'area riservata, che ha lo
 * switcher squadra. */
export function PublicHeader({ team = "u14u15" }: { team?: TrainingTeam } = {}) {
  const isMinivolley = team === "minivolley";
  return (
    <header className="page-header">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Logo team={team} href={isMinivolley ? "/minivolley" : "/"} />
        <div className="flex items-center gap-1">
          <InstallButton />
          <LinkButton href="/login" variant="ghost" size="sm">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Area riservata</span>
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
