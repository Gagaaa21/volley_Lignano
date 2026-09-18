import { LogIn } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/LinkButton";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle/80 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <LinkButton href="/login" variant="ghost" size="sm">
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Area riservata</span>
        </LinkButton>
      </div>
    </header>
  );
}
