"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";

/** L'indirizzo del manuale che si può mandare a chiunque: apre il PDF senza bisogno di accedere. */
const MANUAL_SHARE_PATH = "/manuale-scout.pdf";

/**
 * «Condividi» il manuale d'uso dello Scout. Dal telefono apre il foglio di
 * condivisione (WhatsApp, e-mail, messaggi…) con il link al PDF; dove quel
 * foglio non c'è (di solito il computer) copia il link, pronto da incollare.
 */
export function ShareManualButton({ variant = "outline", size }: { variant?: ButtonVariant; size?: ButtonSize }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function share() {
    const url = new URL(MANUAL_SHARE_PATH, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Scout · Manuale d'uso", text: "Il manuale d'uso dello Scout di Volley Lignano (PDF).", url });
        return;
      } catch (error) {
        // Foglio di condivisione chiuso senza scegliere nessuno: non c'è altro da fare.
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Qualunque altro problema: si ripiega sulla copia del link.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      // Niente appunti (browser vecchio o permesso negato): si mostra il link da copiare a mano.
      window.prompt("Copia questo link e mandalo a chi vuoi:", url);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={share} aria-live="polite" data-scout-share-manual>
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copiato" : "Condividi"}
    </Button>
  );
}
