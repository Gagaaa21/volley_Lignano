"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  THEME_LABELS,
  THEME_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; icon: typeof Sun; short: string }[] = [
  { value: "light", icon: Sun, short: "Chiaro" },
  { value: "dark", icon: Moon, short: "Scuro" },
  { value: "system", icon: Monitor, short: "Auto" },
];

// Piccolo "store" condiviso: tutti i selettori in pagina leggono la stessa scelta e si aggiornano insieme.
const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
function getServerSnapshot(): ThemePreference {
  return "light";
}
function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribe, readThemePreference, getServerSnapshot);
  function choose(next: ThemePreference) {
    saveThemePreference(next);
    listeners.forEach((listener) => listener());
  }
  return [preference, choose];
}

/**
 * Tiene la pagina allineata alla scelta: con "Automatico" segue il dispositivo
 * quando passa da chiaro a scuro; e se la scelta cambia in un'altra scheda del
 * browser, questa la segue. Da montare una sola volta, nel layout principale.
 */
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function refresh() {
      applyThemePreference(readThemePreference());
      listeners.forEach((listener) => listener());
    }
    function onStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY || event.key === null) refresh();
    }
    refresh();
    media.addEventListener("change", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

/** Tre pulsanti affiancati (Chiaro / Scuro / Automatico), per i menu e le pagine di impostazioni. */
export function ThemeSegmented({ className }: { className?: string }) {
  const [preference, choose] = useThemePreference();
  return (
    <div role="group" aria-label="Tema del sito" className={cn("flex gap-0.5 rounded-xl bg-muted p-1", className)} data-theme-switcher>
      {OPTIONS.map(({ value, icon: Icon, short }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={THEME_LABELS[value]}
            title={value === "system" ? "Automatico: segue le impostazioni del dispositivo" : THEME_LABELS[value]}
            onClick={() => choose(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-surface text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {short}
          </button>
        );
      })}
    </div>
  );
}

/** Pulsante con l'icona del tema (sole/luna) che apre la scelta: per le intestazioni dove non c'è un menu. */
export function ThemePopover({ className }: { className?: string }) {
  const [preference, choose] = useThemePreference();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // "Automatico" mostra l'icona di ciò che il dispositivo sta usando ora. Dal server si parte da "chiaro".
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const effective = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  const Icon = effective === "dark" ? Moon : Sun;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Tema del sito"
        title="Tema del sito"
        data-theme-popover
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Tema del sito"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-44 origin-top-right animate-[pop-in_140ms_ease-out] rounded-2xl border border-border bg-popover p-1.5 shadow-pop"
        >
          {OPTIONS.map(({ value, icon: OptionIcon }) => {
            const active = preference === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  choose(value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-muted",
                  active ? "text-foreground" : "text-foreground/75 hover:text-foreground",
                )}
              >
                <OptionIcon className="h-4 w-4" />
                <span className="flex-1">{THEME_LABELS[value]}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
