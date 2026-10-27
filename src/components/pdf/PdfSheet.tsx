"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Download, FileText, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
import { saveFile } from "@/lib/pdf/client";

/**
 * Il PDF visto dentro la pagina, a tutto schermo, per telefoni e tablet: un solo pulsante «PDF» lo apre, e da qui si guarda e si
 * manda («Condividi» apre il foglio del telefono con il file già allegato: WhatsApp, «Salva su File», e-mail…; su Android c'è anche
 * «Scarica»). C'è sempre «Chiudi» (e Esc): si torna alla pagina di prima com'era. Su iPhone e iPad è l'unico modo giusto di aprire un
 * PDF: con il sito sulla schermata Home, un PDF aperto come pagina lascia senza «indietro» e senza un modo per salvarlo o mandarlo.
 */
function PdfSheet({
  file,
  url,
  title,
  canShare,
  apple,
  onClose,
}: {
  file: File;
  url: string;
  title: string;
  canShare: boolean;
  apple: boolean;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // La pagina sotto non scorre mentre il foglio è aperto.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function share() {
    setMessage(null);
    try {
      await navigator.share({ files: [file], title });
    } catch (error) {
      // Foglio chiuso senza scegliere nessuno: non c'è altro da dire.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage({ kind: "error", text: "Non riesco ad aprire la condivisione: riprova tra un attimo." });
    }
  }

  function download() {
    saveFile(file);
    setMessage({ kind: "ok", text: "PDF scaricato." });
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex flex-col bg-background" data-pdf-sheet>
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <FileText className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{title}</p>
          <p className="truncate text-[12px] text-muted-foreground">{file.name}</p>
        </div>
        <button ref={closeButton} type="button" className={buttonVariants({ variant: "outline", size: "md" })} onClick={onClose} data-pdf-sheet-close>
          <X className="h-4 w-4" />
          Chiudi
        </button>
      </header>

      <div className="min-h-0 flex-1 bg-muted">
        <iframe src={url} title={`Anteprima: ${title}`} className="h-full w-full border-0 bg-white" data-pdf-sheet-preview />
      </div>

      <footer className="space-y-2 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {message && (
          <p
            className={message.kind === "error" ? "text-center text-[13px] font-semibold text-destructive" : "flex items-center justify-center gap-1.5 text-center text-[13px] font-semibold text-success"}
            role={message.kind === "error" ? "alert" : "status"}
            data-pdf-sheet-message
          >
            {message.kind === "ok" && <Check className="h-4 w-4" aria-hidden />}
            {message.text}
          </p>
        )}
        {canShare ? (
          <div className={apple ? "grid" : "grid grid-cols-2 gap-2"}>
            <Button type="button" size="lg" onClick={share} data-pdf-sheet-share>
              <Share2 className="h-[18px] w-[18px]" />
              {apple ? "Condividi / Salva su File" : "Condividi"}
            </Button>
            {!apple && (
              <Button type="button" size="lg" variant="outline" onClick={download} data-pdf-sheet-download>
                <Download className="h-[18px] w-[18px]" />
                Scarica
              </Button>
            )}
          </div>
        ) : (
          <p className="text-center text-[13px] text-muted-foreground">Da qui il telefono non può mandare il file: usa il menu di condivisione del sistema.</p>
        )}
        <p className="text-center text-[12px] leading-snug text-muted-foreground">
          {canShare
            ? apple
              ? "Scegli WhatsApp per mandarlo, o «Salva su File» per tenerlo sul telefono. Se vedi solo la prima pagina, il file è comunque intero."
              : "Scegli WhatsApp per mandarlo, oppure «Scarica» per tenerlo sul telefono."
            : "Se vedi solo la prima pagina, il file è comunque intero."}
        </p>
        <Button type="button" variant="outline" size="md" className="w-full" onClick={onClose}>
          Torna al sito
        </Button>
      </footer>
    </div>,
    document.body,
  );
}

/**
 * Il foglio con il suo stato: `open(file, titolo)` lo mostra, `element` va messo nell'albero del componente che lo usa.
 * L'indirizzo temporaneo del file si libera alla chiusura (o quando se ne apre un altro).
 */
export function usePdfSheet(options: { canShare: boolean; apple: boolean }): { open: (file: File, title: string) => void; element: ReactNode } {
  const { canShare, apple } = options;
  const [sheet, setSheet] = useState<{ file: File; url: string; title: string } | null>(null);
  const currentUrl = useRef<string | null>(null);

  const close = useCallback(() => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
    setSheet(null);
  }, []);

  const open = useCallback((file: File, title: string) => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    const url = URL.createObjectURL(file);
    currentUrl.current = url;
    setSheet({ file, url, title });
  }, []);

  return {
    open,
    element: sheet ? <PdfSheet file={sheet.file} url={sheet.url} title={sheet.title} canShare={canShare} apple={apple} onClose={close} /> : null,
  };
}
