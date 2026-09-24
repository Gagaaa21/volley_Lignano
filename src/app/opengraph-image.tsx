import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Volley Lignano";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONTS_DIR = path.join(process.cwd(), "src/assets/fonts");
const CREST_PATH = path.join(process.cwd(), "src/assets/lignano-crest.png");

// L'immagine non dipende da dati della richiesta, quindi si legge una sola
// volta a livello di modulo (resta comunque generata e messa in cache al
// build, non ad ogni condivisione).
const [regularFont, boldFont, crestBuffer] = await Promise.all([
  readFile(path.join(FONTS_DIR, "LiberationSans-Regular.ttf")),
  readFile(path.join(FONTS_DIR, "LiberationSans-Bold.ttf")),
  readFile(CREST_PATH),
]);
const crestSrc = `data:image/png;base64,${crestBuffer.toString("base64")}`;

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2b64a1, #193e66)",
        }}
      >
        <img src={crestSrc} width={220} height={220} style={{ objectFit: "contain" }} />
        <div
          style={{
            marginTop: 40,
            fontSize: 68,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -1,
            fontFamily: "Liberation Sans",
          }}
        >
          Volley Lignano
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 32,
            color: "#cfe0ef",
            fontFamily: "Liberation Sans",
          }}
        >
          Under 14 · Under 15 · Lignano Sabbiadoro
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Liberation Sans", data: regularFont, weight: 400, style: "normal" },
        { name: "Liberation Sans", data: boldFont, weight: 700, style: "normal" },
      ],
    },
  );
}
