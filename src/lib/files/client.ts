/**
 * I file del sito (PDF, CSV, calendari, foto…) visti dal telefono o dal computer di chi li apre. Funzioni che servono solo nel
 * browser (quelle che toccano `navigator` controllano da sole che ci sia): scaricare il file, capire se si può mandare con il foglio
 * di condivisione, riconoscerne il tipo, salvarlo.
 *
 * Perché serve distinguere l'iPhone e l'iPad: con il sito aggiunto alla schermata Home (come si fa per le notifiche) un link che
 * porta a un file lo apre dentro la stessa finestra dell'app, e lì non c'è né «indietro» né un pulsante per salvare o condividere:
 * non si torna più al sito. Quindi su iPhone e iPad un file non si apre mai come pagina: si vede in un foglio dentro la pagina
 * (con «Chiudi» e «Condividi / Salva su File»), vedi FileSheet.
 */

/** Un iPhone, un iPad o un iPod (anche l'iPad che si presenta come un Mac: ha lo schermo a tocco, il Mac no). */
export function isAppleTouchDevice(info: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  return /iPad|iPhone|iPod/.test(info.userAgent) || (info.platform === "MacIntel" && info.maxTouchPoints > 1);
}

/**
 * Il file si apre in un foglio dentro la pagina (con «Condividi») invece che in una scheda nuova o in un download? Su iPhone e iPad
 * sempre (dove una scheda nuova è una trappola); su Android e sugli altri telefoni e tablet, dove si può mandare un file con il
 * foglio di condivisione e si usa il dito (schermo a tocco). Sul computer no: lì il file si apre in una scheda o si scarica, e il
 * browser ha già il suo visualizzatore con «Scarica» e «Stampa».
 */
export function fileOpensInSheet(info: { apple: boolean; canShareFiles: boolean; coarsePointer: boolean }): boolean {
  return info.apple || (info.canShareFiles && info.coarsePointer);
}

export function detectSheetMode(): boolean {
  try {
    return fileOpensInSheet({
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

/** Il telefono (o il browser) sa mandare dei file con il foglio di condivisione? Sul server e sul computer di solito no. */
export function detectFileShare(): boolean {
  return canShareFile(new File(["%PDF-"], "prova.pdf", { type: "application/pdf" }));
}

/** Questo file si può mandare con il foglio di condivisione? Ogni sistema accetta solo certi tipi (Chrome, per esempio, non i .ics). */
export function canShareFile(file: File): boolean {
  try {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Come si mostra un file nel foglio: PDF e immagini con il loro visualizzatore, i file di testo (CSV, calendario…) come testo. */
export type FileKind = "pdf" | "image" | "text" | "other";

export function fileKind(type: string): FileKind {
  const mime = type.toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return "other";
}

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/calendar": "ics",
  "application/json": "json",
  "text/plain": "txt",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Il tipo del file dalla sua estensione, se è uno di quelli che il sito produce. */
export function typeFromName(name: string): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (!extension) return null;
  if (extension === "jpeg") return "image/jpeg";
  return Object.keys(EXTENSIONS).find((type) => EXTENSIONS[type] === extension) ?? null;
}

/** Il nome con la sua estensione: se il tipo è noto e il nome non la ha già, si aggiunge. */
export function nameWithExtension(name: string, type: string): string {
  const extension = EXTENSIONS[type];
  if (!extension || typeFromName(name) === type) return name;
  return `${name}.${extension}`;
}

/** Il nome del file come lo dà il server (`Content-Disposition: attachment; filename="…"`), se c'è. */
export function fileNameFromDisposition(header: string | null): string | null {
  const found = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header ?? "");
  if (!found) return null;
  try {
    return decodeURIComponent(found[1]);
  } catch {
    return found[1];
  }
}

/** Un nome ricavato dall'indirizzo («/api/presenze/atlete/csv» → «csv»), quando il server non ne dà uno. */
function nameFromHref(href: string): string {
  const path = href.split(/[?#]/)[0];
  const last = path.split("/").filter(Boolean).pop();
  return last ? decodeURIComponent(last) : "documento";
}

/** Scarica il file da un indirizzo del sito, con il suo nome e il suo tipo, pronto per essere mostrato e condiviso. */
export async function fetchFile(href: string, fileName?: string): Promise<File> {
  const response = await fetch(href);
  if (!response.ok) throw new Error(`File non disponibile (${response.status})`);
  const blob = await response.blob();
  const name = fileName ?? fileNameFromDisposition(response.headers.get("content-disposition")) ?? nameFromHref(href);
  const declared = (response.headers.get("content-type") ?? blob.type).split(";")[0].trim().toLowerCase();
  const type = declared && declared !== "application/octet-stream" ? declared : (typeFromName(name) ?? declared);
  return new File([blob], nameWithExtension(name, type), { type });
}

/** «840 B», «12 KB», «1,4 MB»: la dimensione come si legge a colpo d'occhio. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Salva il file sul dispositivo come un normale download (dove non c'è il rischio di restare sul file: mai un PDF su iPhone e iPad). */
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
