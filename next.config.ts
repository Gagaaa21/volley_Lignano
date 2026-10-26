import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il manuale dello Scout legge dal disco le sue schermate, i font e lo stemma:
  // si dice a Next di portarli nella funzione che genera il PDF.
  outputFileTracingIncludes: {
    "/api/scout/manuale": ["src/assets/pdf/**/*", "src/assets/fonts/**/*"],
  },
  // Spazio su Vercel: ogni pubblicazione conserva le sue funzioni, e il piano gratuito ha 10 GB in tutto («Functions
  // Storage»). Da solo Next metterebbe in quasi ogni funzione sharp (circa 48 MB, in tre versioni) per ottimizzare le
  // immagini, ma su Vercel le ottimizza il suo servizio e il sito non lo usa altrove; e il motore delle immagini di
  // anteprima (@vercel/og, circa 3 MB), che serve solo a /opengraph-image. Le chiavi sono confrontate «contenute» nel
  // percorso: per questo la home non è nell'elenco («/» le prenderebbe tutte, /opengraph-image compresa) e se lo tiene.
  outputFileTracingExcludes: {
    "/**": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
    "next-server": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
    ...Object.fromEntries(
      ["/_not-found", "/admin/**", "/diretta/**", "/disponibilita/**", "/login/**", "/minivolley/**", "/notifiche/**"].map((route) => [
        route,
        ["node_modules/next/dist/compiled/@vercel/og/**/*"],
      ]),
    ),
  },
  // La gestione delle assenze ora è una sezione a sé: i vecchi indirizzi (anche quelli salvati nei preferiti) portano lì.
  async redirects() {
    return [
      { source: "/admin/partite/assenze", destination: "/admin/assenze", permanent: false },
      { source: "/admin/presenze/atlete/link-genitori", destination: "/admin/assenze/link", permanent: false },
    ];
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
