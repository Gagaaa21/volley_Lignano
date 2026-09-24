import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Libre_Baskerville } from "next/font/google";
import { PwaClient } from "@/components/pwa/PwaClient";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallContext";
import "./globals.css";

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Libre_Baskerville({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
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
  themeColor: "#1f5084",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      data-scroll-behavior="smooth"
      className={`${body.variable} ${display.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <PwaInstallProvider>
          {children}
          <PwaClient />
        </PwaInstallProvider>
      </body>
    </html>
  );
}
