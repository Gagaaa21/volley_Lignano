import { LogIn } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/LinkButton";
import { InstallButton } from "@/components/pwa/InstallButton";

export function PublicHeader() {
  return (
    <header className="page-header">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Logo />
        <div className="flex items-center gap-2">
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
