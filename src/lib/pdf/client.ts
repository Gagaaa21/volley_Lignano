/**
 * I PDF del sito visti dal telefono o dal computer di chi li apre. Funzioni che servono solo nel browser (tutte controllano da sole
 * che ci sia): scaricare il PDF come file, capire se si può mandare con il foglio di condivisione, salvarlo.
 *
 * Perché serve distinguere l'iPhone e l'iPad: con il sito aggiunto alla schermata Home (come si fa per le notifiche) un link che
 * porta a un PDF lo apre dentro la stessa finestra dell'app, e lì non c'è né «indietro» né un pulsante per salvare o condividere:
 * non si torna più al sito. Quindi su iPhone e iPad un PDF non si apre mai come pagina: si vede in un foglio dentro la pagina
 * (con «Chiudi» e «Condividi / Salva su File»), vedi PdfSheet.
 */

/** Un iPhone, un iPad o un iPod (anche l'iPad che si presenta come un Mac: ha lo schermo a tocco, il Mac no). */
export function isAppleTouchDevice(info: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  return /iPad|iPhone|iPod/.test(info.userAgent) || (info.platform === "MacIntel" && info.maxTouchPoints > 1);
}

/**
 * Il PDF si apre in un foglio dentro la pagina (con «Condividi») invece che in una scheda nuova? Su iPhone e iPad sempre (dove una
 * scheda nuova è una trappola); su Android e sugli altri telefoni e tablet, dove si può mandare un file con il foglio di
 * condivisione e si usa il dito (schermo a tocco). Sul computer no: lì il PDF si apre in una scheda e il browser ha già il suo
 * visualizzatore con «Scarica» e «Stampa».
 */
export function pdfOpensInSheet(info: { apple: boolean; canShareFiles: boolean; coarsePointer: boolean }): boolean {
  return info.apple || (info.canShareFiles && info.coarsePointer);
}

export function detectSheetMode(): boolean {
  try {
    return pdfOpensInSheet({
      apple: detectAppleDevice(),
      canShareFiles: detectFileShare(),
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    });
  } catch {
    return false;
  }
}

export function detectAppleDevice(): boolean {
  try {
    return isAppleTouchDevice({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
  } catch {
    return false;
  }
}

/** Il telefono (o il browser) sa mandare un file con il foglio di condivisione? Sul server e sul computer di solito no. */
export function detectFileShare(): boolean {
  try {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File(["%PDF-"], "prova.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

/** Il nome del file come lo dà il server (`Content-Disposition: attachment; filename="…"`), se c'è. */
function nameFromResponse(response: Response): string | null {
  const header = response.headers.get("content-disposition") ?? "";
  const found = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!found) return null;
  try {
    return decodeURIComponent(found[1]);
  } catch {
    return found[1];
  }
}

export async function fetchPdf(href: string, fileName?: string): Promise<File> {
  const response = await fetch(href);
  if (!response.ok) throw new Error(`PDF non disponibile (${response.status})`);
  const name = fileName ?? nameFromResponse(response) ?? "documento.pdf";
  return new File([await response.blob()], name.endsWith(".pdf") ? name : `${name}.pdf`, { type: "application/pdf" });
}

/** Salva il file sul dispositivo come un normale download (solo dove non c'è il rischio di restare sul PDF: mai su iPhone e iPad). */
export function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
