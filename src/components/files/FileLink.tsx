"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { detectAppleDevice, detectSheetMode, fetchFile, saveFile } from "@/lib/files/client";
import { useFileSheet } from "./FileSheet";

const subscribeNothing = () => () => {};

/**
 * Come si consegna un file a chi lo ha chiesto: su telefono e tablet si apre nel foglio dentro la pagina (`deliver`), sul computer
 * si scarica. `element` è il foglio e va messo nell'albero del componente che lo usa. Serve ai pulsanti che il file lo creano sul
 * posto (il CSV dei test fisici, il calendario di un evento, la copia dello Scout); per i file che vengono dal server c'è `FileLink`.
 */
export function useFileDelivery(): { inSheet: boolean; deliver: (file: File, title?: string) => void; element: ReactNode } {
  const inSheet = useSyncExternalStore(subscribeNothing, detectSheetMode, () => false);
  const apple = useSyncExternalStore(subscribeNothing, detectAppleDevice, () => false);
  const { open, element } = useFileSheet({ apple });
  const deliver = useCallback(
    (file: File, title?: string) => {
      if (inSheet) open(file, title ?? file.name);
      else saveFile(file);
    },
    [inSheet, open],
  );
  return { inSheet, deliver, element };
}

export type FileLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  "aria-label"?: string;
  /** Sul computer: in una scheda nuova (`_blank`), oppure nella pagina. `download` salva il file. */
  target?: "_blank";
  download?: boolean;
  /** Il titolo del foglio che si apre su telefono e tablet (di serie, il nome del file). */
  sheetTitle?: string;
  fileName?: string;
  [attribute: `data-${string}`]: string | boolean | undefined;
};

/**
 * L'unico pulsante di un file del sito («PDF», «Scarica PDF», «Esporta CSV», «Vedi la foto»…): si guarda e si manda da qui, non ci
 * sono due pulsanti.
 * - Sul computer è un normale link: il file si apre in una scheda (o si scarica), con il visualizzatore del browser.
 * - Su telefono e tablet è un pulsante che apre il file in un foglio dentro la pagina, con «Condividi» (WhatsApp, «Salva su File»,
 *   e-mail…), «Scarica» (su Android) e «Chiudi». Su iPhone e iPad è l'unico modo: con il sito sulla schermata Home un link a un file
 *   lo apre nella stessa finestra dell'app, senza «indietro» e senza un modo per salvarlo o mandarlo, e non si torna più al sito.
 * Il file si scarica al tocco (con quello che c'è a schermo in quel momento, per esempio le convocate scelte): quando il foglio si
 * apre il file è già pronto, quindi «Condividi» parte al primo tocco.
 */
export function FileLink({ href, className, children, target, download, sheetTitle, fileName, title, "aria-label": ariaLabel, ...rest }: FileLinkProps) {
  const { inSheet, deliver, element } = useFileDelivery();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  if (!inSheet) {
    return (
      <a
        href={href}
        className={className}
        title={title}
        aria-label={ariaLabel}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        download={download ? "" : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  }

  async function open() {
    if (state === "loading") return;
    setState("loading");
    try {
      const file = await fetchFile(href, fileName);
      deliver(file, sheetTitle ?? file.name.replace(/\.[a-z0-9]+$/i, ""));
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-busy={state === "loading"}
        disabled={state === "loading"}
        onClick={open}
        data-file-open
        data-file-href={href}
        {...rest}
      >
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
      {state === "error" && (
        <span className="text-[13px] font-semibold text-destructive" role="alert" data-file-error>
          File non disponibile: riprova
        </span>
      )}
      {element}
    </>
  );
}
