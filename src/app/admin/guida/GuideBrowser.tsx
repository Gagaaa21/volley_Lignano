"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";

/** Una sezione della guida: o un elenco di punti (`points`), o un contenuto già pronto (`body`, con il testo per la ricerca). */
export interface GuideItem {
  id: string;
  icon: ReactNode;
  title: string;
  intro: string;
  points?: string[];
  body?: ReactNode;
  searchText?: string;
}

/** Minuscole e senza accenti: «gia» trova «già». */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const BULLETS =
  "space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']";

/**
 * La guida come un indice: le sezioni stanno chiuse, con il titolo e una riga che dice di cosa parlano; si apre quella che serve (o tutte),
 * oppure si scrive una parola e restano solo le sezioni che ne parlano, già aperte. Un indirizzo con `#sezione` apre quella sezione.
 * Il testo delle sezioni chiuse resta nella pagina: cambia solo quello che si vede.
 */
export function GuideBrowser({ items }: { items: GuideItem[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const needle = normalize(query.trim());

  const matching = useMemo(() => {
    if (!needle) return new Set(items.map((item) => item.id));
    return new Set(
      items
        .filter((item) => normalize(`${item.title} ${item.intro} ${item.points?.join(" ") ?? item.searchText ?? ""}`).includes(needle))
        .map((item) => item.id),
    );
  }, [items, needle]);

  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id || !items.some((item) => item.id === id)) return;
      setOpen((current) => new Set(current).add(id));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [items]);

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = items.every((item) => open.has(item.id));

  return (
    <div data-guide>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca nella guida…"
            aria-label="Cerca nella guida"
            className="pl-10 pr-10"
            data-guide-search
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cancella la ricerca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!needle && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((item) => item.id)))}
            className="text-sm font-semibold text-primary hover:underline"
            data-guide-toggle-all
          >
            {allOpen ? "Chiudi tutte" : "Apri tutte"}
          </button>
        )}
      </div>

      {needle && (
        <p className="mb-4 text-sm text-muted-foreground" role="status" data-guide-count>
          {matching.size === 0
            ? "Nessuna sezione ne parla. Prova con un'altra parola."
            : matching.size === 1
              ? "Una sezione ne parla."
              : `${matching.size} sezioni ne parlano.`}
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const isOpen = needle ? matching.has(item.id) : open.has(item.id);
          return (
            <Card key={item.id} id={item.id} className="scroll-mt-24 overflow-hidden" hidden={!matching.has(item.id)} data-guide-section={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={`${item.id}-body`}
                className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60 sm:px-6"
              >
                <span className="icon-chip shrink-0">{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold text-foreground">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{item.intro}</span>
                </span>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
              </button>
              <div id={`${item.id}-body`} hidden={!isOpen} className="px-5 pb-5 sm:px-6 sm:pb-6">
                {item.points ? (
                  <ul className={BULLETS}>
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : (
                  item.body
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
