import type { PushSubscriptionRecord, TrainingTeam } from "@/lib/types";

/**
 * Cosa scrivere quando un dispositivo manda la sua iscrizione alle notifiche (route /api/push/subscribe). La regola che conta:
 * una iscrizione già registrata non cambia mai squadra. U14/U15 e Minivolley sono due cose distinte, quindi la squadra si
 * sceglie una volta, attivando le notifiche dal sito di quella squadra (nuova iscrizione), e poi nessuno la sposta: né un
 * rinnovo, né l'accesso all'area riservata, né un'app rimasta alla versione vecchia (che dava all'iscrizione la squadra del
 * selettore). Per cambiare squadra si toglie l'iscrizione e se ne fa una nuova.
 */
export interface SubscribeRequest {
  endpoint: string;
  p256dh: string;
  auth: string;
  /** La squadra indicata dal dispositivo: vale solo per un indirizzo che il sito non conosce ancora. */
  team: TrainingTeam;
  /** Rinnovo silenzioso (nuove chiavi, controllo periodico): squadra e account restano quelli già registrati. */
  refresh: boolean;
  /** Area riservata: collega l'account di chi è entrato a un'iscrizione che c'è già, senza cambiarne la squadra. */
  linkStaff: boolean;
  /** Indirizzo precedente, quando il browser lo ha sostituito (pushsubscriptionchange). */
  oldEndpoint: string | null;
}

export interface SubscribePlan {
  upsert: { endpoint: string; p256dh: string; auth: string; staffId: string | null; team: TrainingTeam };
  /** L'indirizzo vecchio da togliere, se il browser ne ha dato uno nuovo. */
  removeEndpoint: string | null;
}

export function planSubscription(
  known: PushSubscriptionRecord[],
  request: SubscribeRequest,
  sessionStaffId: string | null,
): SubscribePlan {
  const { endpoint, p256dh, auth } = request;
  const current = known.find((sub) => sub.endpoint === endpoint);

  if (request.refresh || request.oldEndpoint !== null) {
    const previous = current ?? (request.oldEndpoint !== null ? known.find((sub) => sub.endpoint === request.oldEndpoint) : undefined);
    if (previous) {
      return {
        upsert: { endpoint, p256dh, auth, staffId: previous.staffId, team: previous.team },
        removeEndpoint: previous.endpoint !== endpoint ? previous.endpoint : null,
      };
    }
  }

  return {
    upsert: {
      endpoint,
      p256dh,
      auth,
      staffId: request.linkStaff ? (sessionStaffId ?? current?.staffId ?? null) : sessionStaffId,
      team: current?.team ?? request.team,
    },
    removeEndpoint: null,
  };
}
