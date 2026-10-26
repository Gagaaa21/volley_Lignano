"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";

/** Copia un testo negli appunti (se il browser non lo permette lo mostra, da copiare a mano) e per un attimo dice «Copiato». */
export function CopyTextButton({
  text,
  children = "Copia",
  ariaLabel,
  variant = "outline",
  size = "sm",
  ...rest
}: {
  text: string;
  children?: ReactNode;
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  [dataAttribute: `data-${string}`]: string | boolean | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copia il testo:", text);
    }
  }

  return (
    <Button type="button" size={size} variant={variant} onClick={copy} aria-label={ariaLabel} data-copied={copied ? "true" : "false"} {...rest}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiato" : children}
    </Button>
  );
}
