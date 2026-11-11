"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * «Condividi» in cima a /diretta: il foglio di condivisione del telefono (WhatsApp, messaggi…) con l'indirizzo della
 * pagina; dove non c'è (computer) copia l'indirizzo negli appunti e lo dice.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/diretta`;
    const text = "Segui la partita di Volley Lignano in diretta, con il punteggio";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Volley Lignano in diretta", text, url });
      } catch {
        // Annullata: niente da fare.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Appunti non disponibili: l'indirizzo è nella barra del browser.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="hit-area relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary hover:bg-primary-soft"
      data-diretta-share
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copiato" : "Condividi"}
    </button>
  );
}
