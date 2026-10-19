import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { NotificationSettings } from "@/components/pwa/NotificationSettings";

export const metadata: Metadata = {
  title: "Notifiche",
  description: "Le notifiche di Volley Lignano su questo dispositivo.",
  robots: { index: false, follow: false },
};

/** Le notifiche di questo dispositivo, squadra per squadra: U14/U15 e Minivolley sono due cose distinte (vedi NotificationSettings). */
export default function NotifichePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Notifiche di questo dispositivo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le notifiche di Under 14 e Under 15 e quelle di Minivolley sono due cose distinte: le attivi e le disattivi una per volta,
          su ogni dispositivo.
        </p>
        <div className="mt-6">
          <NotificationSettings team="u14u15" />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
