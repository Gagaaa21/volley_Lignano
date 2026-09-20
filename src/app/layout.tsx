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

export const metadata: Metadata = {
  title: {
    default: "Volley Lignano",
    template: "%s · Volley Lignano",
  },
  description:
    "Calendario ufficiale di allenamenti e partite delle squadre femminili Under 14 e Under 15 di Volley Lignano.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Volley Lignano",
  },
};

export const viewport: Viewport = {
  themeColor: "#145470",
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
