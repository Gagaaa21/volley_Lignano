import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sostituisce solo manifest e identità PWA per questo ramo: Minivolley è
// installabile come app a parte, con la sua icona (il logo Volley S3) e il
// suo nome nella schermata Home, separata dall'app principale U14/U15.
export const metadata: Metadata = {
  title: { absolute: "Volley Lignano S3" },
  manifest: "/manifest-s3.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Volley S3",
  },
};

export default function MinivolleyLayout({ children }: { children: ReactNode }) {
  return children;
}
