"use client";

import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

/** Campo di ricerca per filtrare un elenco lato client. */
export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        className="h-10 w-full rounded-xl border border-input bg-surface pl-10 pr-3.5 text-base text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:text-sm"
        {...props}
      />
    </div>
  );
}
