"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/auth/session";
import type { AdminPage, TrainingTeam } from "@/lib/types";
import { closeMobileMenuIfOpen } from "./engine/helpers";
import { TourOverlay } from "./engine/TourOverlay";
import { useTourEngine } from "./engine/useTourEngine";
import { finishTourAction } from "./actions";
import { getVisibleSteps, type TourStep } from "./steps";

export function Tour({
  session,
  allowedPages,
  allowedTeams,
  activeTeam,
}: {
  session: SessionPayload;
  allowedPages: AdminPage[];
  allowedTeams: TrainingTeam[];
  activeTeam: TrainingTeam;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [steps] = useState<TourStep[]>(() =>
    getVisibleSteps(session.role, allowedPages, allowedTeams, activeTeam),
  );

  const engine = useTourEngine(steps, {
    onFinish: () => void finishTourAction(),
    onBeforeStepChange: closeMobileMenuIfOpen,
  });

  // Avvio automatico al primo accesso. Il layout che monta <Tour> non si
  // rimonta mai navigando tra le pagine /admin/* (nemmeno dopo il redirect
  // che segue il cambio password forzato: è la stessa istanza del
  // componente, solo con nuove props) — quindi decidere una volta sola al
  // primo mount (es. con un useState pigro) resterebbe bloccato al valore
  // letto mentre si era ancora su /admin/cambia-password (mustChangePassword
  // true). Questo effect osserva invece session.mustChangePassword/
  // hasSeenGuide a ogni render successivo e decide una sola volta (via ref,
  // non stato) non appena il cambio password forzato è concluso.
  const autoStartDecided = useRef(false);
  useEffect(() => {
    if (autoStartDecided.current || session.mustChangePassword) return;
    autoStartDecided.current = true;
    if (!session.hasSeenGuide) engine.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.mustChangePassword, session.hasSeenGuide]);

  // "Rivedi il tour guidato" (pulsante in /admin/guida): riparte anche se
  // hasSeenGuide è già true. Il link punta sempre a una pagina diversa da
  // /admin/guida (il passo "welcome"), quindi il cambio di pathname fa
  // rieseguire questo effetto in modo affidabile senza bisogno di
  // useSearchParams (e del relativo obbligo di un boundary Suspense).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("tour") !== "restart") return;
    engine.start();
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!engine.active) return null;
  return <TourOverlay {...engine} />;
}
