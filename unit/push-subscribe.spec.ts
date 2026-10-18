import { expect, test } from "@playwright/test";
import { planSubscription, type SubscribeRequest } from "@/lib/pushSubscribe";
import type { PushSubscriptionRecord } from "@/lib/types";

/**
 * Cosa scrive il sito quando un dispositivo manda la sua iscrizione alle notifiche. La regola che conta: una iscrizione già
 * registrata non cambia mai squadra (U14/U15 e Minivolley sono due cose distinte).
 */

const record = (patch: Partial<PushSubscriptionRecord>): PushSubscriptionRecord => ({
  id: "id",
  endpoint: "https://push.example/a",
  p256dh: "p",
  auth: "a",
  staffId: null,
  team: "u14u15",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

const request = (patch: Partial<SubscribeRequest>): SubscribeRequest => ({
  endpoint: "https://push.example/a",
  p256dh: "p2",
  auth: "a2",
  team: "u14u15",
  refresh: false,
  linkStaff: false,
  oldEndpoint: null,
  ...patch,
});

test.describe("iscrizioni alle notifiche", () => {
  test("un indirizzo nuovo nasce con la squadra indicata e con l'account di chi lo manda", () => {
    const plan = planSubscription([], request({ team: "minivolley" }), "staff-1");
    expect(plan.upsert).toEqual({ endpoint: "https://push.example/a", p256dh: "p2", auth: "a2", staffId: "staff-1", team: "minivolley" });
    expect(plan.removeEndpoint).toBeNull();
    expect(planSubscription([], request({}), null).upsert.staffId).toBeNull();
  });

  test("un'iscrizione che c'è già non cambia squadra, nemmeno se un'app vecchia (selettore squadra) lo chiede", () => {
    const known = [record({ team: "minivolley", staffId: "staff-1" })];
    const plan = planSubscription(known, request({ team: "u14u15" }), "staff-2");
    expect(plan.upsert.team).toBe("minivolley");
    // L'account invece si aggiorna: è quello di chi è entrato adesso.
    expect(plan.upsert.staffId).toBe("staff-2");
  });

  test("il rinnovo silenzioso tiene squadra e account", () => {
    const known = [record({ team: "minivolley", staffId: "staff-1" })];
    const plan = planSubscription(known, request({ team: "u14u15", refresh: true }), "staff-2");
    expect(plan.upsert).toMatchObject({ team: "minivolley", staffId: "staff-1", p256dh: "p2", auth: "a2" });
    expect(plan.removeEndpoint).toBeNull();
  });

  test("se il browser cambia indirizzo l'iscrizione si sposta, con la stessa squadra, e quella vecchia si toglie", () => {
    const known = [record({ team: "minivolley", staffId: "staff-1" })];
    const plan = planSubscription(known, request({ endpoint: "https://push.example/b", oldEndpoint: "https://push.example/a", refresh: true }), null);
    expect(plan.upsert).toMatchObject({ endpoint: "https://push.example/b", team: "minivolley", staffId: "staff-1" });
    expect(plan.removeEndpoint).toBe("https://push.example/a");
  });

  test("un rinnovo per un indirizzo sconosciuto è un'iscrizione nuova, con la squadra indicata", () => {
    const plan = planSubscription([], request({ endpoint: "https://push.example/x", team: "u14u15", refresh: true }), null);
    expect(plan.upsert).toMatchObject({ endpoint: "https://push.example/x", team: "u14u15" });
    expect(plan.removeEndpoint).toBeNull();
  });

  test("area riservata: l'account si collega all'iscrizione che c'è, la squadra non cambia", () => {
    const known = [record({ team: "minivolley", staffId: null })];
    const plan = planSubscription(known, request({ team: "u14u15", linkStaff: true }), "staff-1");
    expect(plan.upsert).toMatchObject({ team: "minivolley", staffId: "staff-1" });
  });

  test("area riservata senza sessione: l'account di prima resta", () => {
    const known = [record({ staffId: "staff-1" })];
    expect(planSubscription(known, request({ linkStaff: true }), null).upsert.staffId).toBe("staff-1");
  });

  test("senza il collegamento un invio anonimo scollega l'account, come sempre", () => {
    const known = [record({ staffId: "staff-1" })];
    expect(planSubscription(known, request({}), null).upsert.staffId).toBeNull();
  });
});
