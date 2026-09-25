"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buildOpenInChromeUrl, usePwaInstall } from "./PwaInstallContext";

/** Icona discreta, sempre presente quando l'installazione è possibile: non compete
 * con le azioni principali dell'header, ma resta a portata di click. */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, isIOS, isAndroidNonChrome, isStandalone, promptInstall } = usePwaInstall();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [showChromeHint, setShowChromeHint] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showIOSHint && !showChromeHint) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setShowIOSHint(false);
        setShowChromeHint(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showIOSHint, showChromeHint]);

  if (isStandalone || (!canInstall && !isIOS && !isAndroidNonChrome)) return null;

  async function handleClick() {
    if (isAndroidNonChrome) {
      setShowChromeHint((v) => !v);
      return;
    }
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowIOSHint((v) => !v);
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleClick}
        title="Installa l'app"
        aria-label="Installa l'app"
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/35 transition-colors hover:bg-muted hover:text-foreground"
      >
        <Download className="h-4 w-4" />
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

      {showChromeHint && (
        <div
          role="dialog"
          aria-label="Come installare su Android"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border-subtle bg-surface p-4 text-sm shadow-[0_20px_50px_-20px_rgba(9,27,38,0.35)]"
        >
          <button
            type="button"
            onClick={() => setShowChromeHint(false)}
            aria-label="Chiudi"
            className="absolute right-2 top-2 rounded-full p-1 text-foreground/40 hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="pr-5 font-display font-bold text-foreground">Installa da Chrome</p>
          <p className="mt-2 text-foreground/70">
            Il tuo browser blocca l&apos;installazione per un problema noto di Android: apri il
            sito in Chrome per installarlo senza avvisi.
          </p>
          <a
            href={buildOpenInChromeUrl()}
            className="mt-3 flex items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Apri in Chrome
          </a>
        </div>
      )}
    </div>
  );
}
