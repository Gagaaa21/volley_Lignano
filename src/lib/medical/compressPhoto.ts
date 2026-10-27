/**
 * Solo nel browser: rimpicciolisce la foto del certificato prima di mandarla (le foto del telefono pesano anche 5-10 MB; qui
 * diventano un JPEG di qualche centinaio di KB, ancora ben leggibile). Il lato più lungo al massimo 2000 pixel; se pesa ancora
 * troppo si abbassa la qualità. Il server ricontrolla comunque tipo e peso (vedi photo.ts).
 */

const MAX_SIDE = 2000;
const TARGET_BYTES = 1_200_000;

export class PhotoUnreadableError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new PhotoUnreadableError("La foto non si apre."));
    image.src = url;
  });
}

export async function compressPhoto(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoUnreadableError("Il telefono non riesce a preparare la foto.");
    // Sfondo bianco: una PNG trasparente diventerebbe nera in JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let best: Blob | null = null;
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) break;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!best) throw new PhotoUnreadableError("Il telefono non riesce a preparare la foto.");
    return best;
  } finally {
    URL.revokeObjectURL(url);
  }
}
