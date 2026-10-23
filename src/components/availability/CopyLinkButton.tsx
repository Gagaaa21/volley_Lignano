"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Copia il link personale negli appunti (se il browser non lo permette lo mostra, da copiare a mano). */
export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copia il link:", url);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={`Copia il link di ${label}`} data-copy-family-link>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiato" : "Copia link"}
    </Button>
  );
}
