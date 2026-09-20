"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button-variants";
import { usePwaInstall } from "./PwaInstallContext";

export function InstallButton({
  variant = "button",
  className,
}: {
  variant?: "button" | "nav-tile";
  className?: string;
}) {
  const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showIOSHint) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setShowIOSHint(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showIOSHint]);

  if (isStandalone || (!canInstall && !isIOS)) return null;

  async function handleClick() {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowIOSHint((v) => !v);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Installa l'app"
        className={cn(
          variant === "nav-tile" ? "nav-tile w-full sm:w-auto" : buttonVariants({ variant: "ghost", size: "sm" }),
          className,
        )}
      >
        <Download className="h-4 w-4" />
        <span className={variant === "button" ? "hidden sm:inline" : undefined}>Installa app</span>
      </button>

      {showIOSHint && (
        <div
          role="dialog"
          aria-label="Come installare su iPhone"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border-subtle bg-surface p-4 text-sm shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]"
        >
          <button
            type="button"
            onClick={() => setShowIOSHint(false)}
            aria-label="Chiudi"
            className="absolute right-2 top-2 rounded-full p-1 text-foreground/40 hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-5 font-display font-bold text-foreground">Installa su iPhone</p>
          <p className="mt-2 flex items-center gap-1.5 text-foreground/70">
            <Share className="h-4 w-4 shrink-0 text-primary" />
            Tocca <span className="font-semibold text-foreground">Condividi</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-foreground/70">
            <SquarePlus className="h-4 w-4 shrink-0 text-primary" />
            Poi <span className="font-semibold text-foreground">Aggiungi a Home</span>
          </p>
        </div>
      )}
    </div>
  );
}
