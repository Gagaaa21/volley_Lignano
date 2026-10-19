import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { NotificationSettings } from "@/components/pwa/NotificationSettings";

export const metadata: Metadata = {
  title: "Notifiche Minivolley",
  robots: { index: false, follow: false },
};

/** Le notifiche di questo dispositivo, dal sito (e dall'app) di Minivolley: le stesse di /notifiche, con Minivolley per prima. */
export default function MinivolleyNotifichePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader team="minivolley" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Notifiche di questo dispositivo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le notifiche di Minivolley e quelle di Under 14 e Under 15 sono due cose distinte: le attivi e le disattivi una per volta,
          su ogni dispositivo.
        </p>
        <div className="mt-6">
          <NotificationSettings team="minivolley" />
        </div>
      </main>
      <PublicFooter team="minivolley" />
    </div>
  );
}
