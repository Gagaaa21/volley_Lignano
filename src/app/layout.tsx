import type { Metadata, Viewport } from "next";
import { Archivo, Baloo_2, Inter } from "next/font/google";
import { PwaClient } from "@/components/pwa/PwaClient";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallContext";
import { ThemeSync } from "@/components/theme/ThemeSwitcher";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Titoli e numeri: grottesco sportivo con asse di larghezza (usato in
// versione leggermente "espansa", vedi font-stretch in globals.css).
const display = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Titoli del sito Minivolley: un carattere rotondo e giocoso al posto di
// quello del sito U14/U15 principale, applicato solo dentro
// [data-theme="minivolley"] (vedi globals.css) — un segnale immediato, a
// colpo d'occhio, che non si tratta della stessa pagina.
const displayMinivolley = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const SITE_URL = "https://volley-lignano.vercel.app";
const SITE_TITLE = "Volley Lignano";
const SITE_DESCRIPTION =
  "Calendario ufficiale di allenamenti e partite delle squadre femminili Under 14 e Under 15 di Volley Lignano.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Volley Lignano",
  },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Volley Lignano",
  },
  // Anteprima quando un link al sito viene condiviso (es. il tasto
  // "Condividi" di un evento, che condivide sempre l'indirizzo principale):
  // senza questi tag l'anteprima su WhatsApp/social sarebbe vuota.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "it_IT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#1c5bae",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: lo script nel <head> imposta data-color-scheme
    // prima che React parta (è voluto: evita il lampo bianco col tema scuro).
    <html
      lang="it"
      data-scroll-behavior="smooth"
      className={`${body.variable} ${display.variable} ${displayMinivolley.variable} h-full scroll-smooth antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <PwaInstallProvider>
          {children}
          <PwaClient />
          <ThemeSync />
        </PwaInstallProvider>
      </body>
    </html>
  );
}
