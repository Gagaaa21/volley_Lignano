import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il manuale dello Scout legge dal disco le sue schermate, i font e lo stemma:
  // si dice a Next di portarli nella funzione che genera il PDF.
  outputFileTracingIncludes: {
    "/api/scout/manuale": ["src/assets/pdf/**/*", "src/assets/fonts/**/*"],
  },
  async headers() {
    return [
      {
        // La pagina del genitore ha il codice segreto nell'indirizzo: non deve finire nei motori di ricerca né nell'«indirizzo di
        // provenienza» che il browser manda ad altri siti (vedi anche i metadati della pagina).
        source: "/disponibilita/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
