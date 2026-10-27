import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { ADMIN_PAGES, ADMIN_PAGE_LABELS, DEFAULT_NEW_ADMIN_PAGES, isPageAvailableForTeam } from "@/lib/types";
import {
  MAX_VALIDITY_YEARS,
  certificateFromInput,
  certificateKey,
  certificateStatus,
  compareUrgency,
  isCertificateValid,
  isIsoDate,
  needsAttention,
  oneYearAfter,
  parentReminder,
  parseCertificate,
  serializeCertificate,
  statusLabel,
  warningFrom,
  type CertificateStatus,
  type MedicalCertificate,
} from "@/lib/medical/certificate";

/** I certificati medici: valido, in scadenza (rosso da un mese prima), scaduto o senza date; le date che si possono scrivere. */

const cert = (validUntil: string, overrides: Partial<MedicalCertificate> = {}): MedicalCertificate => ({
  athleteId: "a1",
  issuedOn: "2026-03-12",
  validUntil,
  by: "parent",
  updatedBy: null,
  updatedAt: "2026-03-13T10:00:00.000Z",
  ...overrides,
});

test.describe("stato del certificato", () => {
  test("senza date non è valido: «Da inserire»", () => {
    const status = certificateStatus(null, "2026-10-27");
    expect(status).toEqual({ kind: "missing" });
    expect(isCertificateValid(status)).toBe(false);
    expect(needsAttention(status)).toBe(true);
    expect(statusLabel(status)).toMatchObject({ badge: "Da inserire", tone: "warning" });
  });

  test("lontano dalla scadenza è valido, verde", () => {
    const status = certificateStatus(cert("2027-03-12"), "2026-10-27");
    expect(status.kind).toBe("valid");
    expect(isCertificateValid(status)).toBe(true);
    expect(needsAttention(status)).toBe(false);
    expect(statusLabel(status)).toEqual({ badge: "Valido", tone: "success", detail: "Valido fino al 12 marzo 2027." });
  });

  test("diventa rosso esattamente un mese prima della scadenza, e resta valido fino all'ultimo giorno compreso", () => {
    const c = cert("2026-11-27");
    expect(certificateStatus(c, "2026-10-26").kind).toBe("valid");
    const first = certificateStatus(c, "2026-10-27");
    expect(first).toEqual({ kind: "expiring", validUntil: "2026-11-27", daysLeft: 31 });
    expect(isCertificateValid(first)).toBe(true);
    expect(statusLabel(first)).toMatchObject({ badge: "Scade tra 31 giorni", tone: "danger" });

    expect(statusLabel(certificateStatus(c, "2026-11-26")).badge).toBe("Scade domani");
    const last = certificateStatus(c, "2026-11-27");
    expect(last).toMatchObject({ kind: "expiring", daysLeft: 0 });
    expect(statusLabel(last)).toMatchObject({ badge: "Scade oggi", tone: "danger" });
    expect(statusLabel(last).detail).toBe("Valido fino al 27 novembre 2026: scade oggi, va rinnovato.");
  });

  test("dal giorno dopo la scadenza non è più valido", () => {
    const status = certificateStatus(cert("2026-10-03"), "2026-10-27");
    expect(status).toEqual({ kind: "expired", validUntil: "2026-10-03", daysAgo: 24 });
    expect(isCertificateValid(status)).toBe(false);
    expect(statusLabel(status)).toEqual({ badge: "Scaduto", tone: "danger", detail: "Non valido: scaduto il 3 ottobre 2026." });
  });

  test("il mese prima segue il calendario: a fine mese si ferma all'ultimo giorno del mese prima", () => {
    expect(warningFrom("2027-03-31")).toBe("2027-02-28");
    expect(warningFrom("2028-03-31")).toBe("2028-02-29");
    expect(warningFrom("2027-01-15")).toBe("2026-12-15");
    expect(warningFrom("2026-12-31")).toBe("2026-11-30");
  });

  test("in cima chi è scaduto, poi chi scade prima, poi chi non ha le date, infine chi è in regola", () => {
    const today = "2026-10-27";
    const statuses: [string, CertificateStatus][] = [
      ["valida lontana", certificateStatus(cert("2027-09-01"), today)],
      ["senza date", certificateStatus(null, today)],
      ["scade tra 20", certificateStatus(cert("2026-11-16"), today)],
      ["scaduta da poco", certificateStatus(cert("2026-10-20"), today)],
      ["valida vicina", certificateStatus(cert("2027-01-10"), today)],
      ["scade tra 3", certificateStatus(cert("2026-10-30"), today)],
      ["scaduta da tanto", certificateStatus(cert("2026-06-01"), today)],
    ];
    const order = [...statuses].sort((a, b) => compareUrgency(a[1], b[1])).map(([name]) => name);
    expect(order).toEqual([
      "scaduta da tanto",
      "scaduta da poco",
      "scade tra 3",
      "scade tra 20",
      "senza date",
      "valida vicina",
      "valida lontana",
    ]);
  });
});

test.describe("date scritte dal genitore o dallo staff", () => {
  const today = "2026-10-27";

  test("due giorni veri, la visita non nel futuro e la scadenza dopo la visita", () => {
    expect(certificateFromInput("2026-10-20", "2027-10-20", today)).toEqual({ ok: true, issuedOn: "2026-10-20", validUntil: "2027-10-20" });
    // Visita oggi: si può.
    expect(certificateFromInput(today, "2027-10-27", today).ok).toBe(true);
    // Un certificato già scaduto si può scrivere lo stesso (il sito dirà «Scaduto»).
    expect(certificateFromInput("2025-09-01", "2026-09-01", today).ok).toBe(true);
  });

  test("ogni errore dice cosa correggere", () => {
    expect(certificateFromInput("", "2027-10-20", today)).toEqual({ ok: false, error: "Scegli il giorno in cui è stata fatta la visita." });
    expect(certificateFromInput("2026-10-20", "", today)).toEqual({ ok: false, error: "Scegli fino a quando vale il certificato." });
    expect(certificateFromInput("2026-02-30", "2027-02-28", today).ok).toBe(false);
    expect(certificateFromInput(null, undefined, today).ok).toBe(false);
    expect(certificateFromInput("2026-10-28", "2027-10-28", today)).toEqual({
      ok: false,
      error: "La visita non può essere in un giorno che deve ancora venire.",
    });
    expect(certificateFromInput("2026-10-20", "2026-10-20", today)).toEqual({
      ok: false,
      error: "Il certificato deve valere fino a un giorno dopo la visita.",
    });
    expect(certificateFromInput("2026-10-20", "2026-09-20", today).ok).toBe(false);
  });

  test(`la scadenza al massimo ${MAX_VALIDITY_YEARS} anni dopo la visita: oltre è quasi sicuramente un errore`, () => {
    expect(certificateFromInput("2026-10-20", "2028-10-20", today).ok).toBe(true);
    expect(certificateFromInput("2026-10-20", "2028-10-21", today)).toEqual({
      ok: false,
      error: "Controlla la scadenza: un certificato vale di solito un anno dalla visita.",
    });
  });

  test("gli spazi attorno alle date non contano", () => {
    expect(certificateFromInput(" 2026-10-20 ", "2027-10-20\n", today)).toEqual({ ok: true, issuedOn: "2026-10-20", validUntil: "2027-10-20" });
  });

  test("un anno dopo la visita: la scadenza da proporre", () => {
    expect(oneYearAfter("2026-10-20")).toBe("2027-10-20");
    expect(oneYearAfter("2028-02-29")).toBe("2029-02-28");
  });

  test("solo giorni veri nel formato AAAA-MM-GG", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2027-13-01")).toBe(false);
    expect(isIsoDate("27/10/2026")).toBe(false);
    expect(isIsoDate("2026-10-27T10:00")).toBe(false);
    expect(isIsoDate(20261027)).toBe(false);
  });
});

test.describe("come si salva", () => {
  test("si rilegge uguale", () => {
    const c = cert("2027-03-12", { by: "staff", updatedBy: "staff-1" });
    expect(parseCertificate("a1", serializeCertificate(c))).toEqual(c);
    // L'id dell'atleta sta nella chiave, non nel valore.
    expect(JSON.parse(serializeCertificate(c))).not.toHaveProperty("athleteId");
    expect(certificateKey("a1")).toBe("medical_certificate:a1");
  });

  test("un valore rotto o senza date vere non è un certificato", () => {
    expect(parseCertificate("a1", null)).toBeNull();
    expect(parseCertificate("a1", "")).toBeNull();
    expect(parseCertificate("a1", "non json")).toBeNull();
    expect(parseCertificate("a1", "[]")).toBeNull();
    expect(parseCertificate("a1", JSON.stringify({ issuedOn: "2026-03-12" }))).toBeNull();
    expect(parseCertificate("a1", JSON.stringify({ issuedOn: "2026-03-12", validUntil: "2027-02-30" }))).toBeNull();
  });

  test("i campi che mancano prendono un valore sicuro: scritto dal genitore, senza autore", () => {
    expect(parseCertificate("a1", JSON.stringify({ issuedOn: "2026-03-12", validUntil: "2027-03-12", by: "altro", updatedBy: "" }))).toEqual({
      athleteId: "a1",
      issuedOn: "2026-03-12",
      validUntil: "2027-03-12",
      by: "parent",
      updatedBy: null,
      updatedAt: new Date(0).toISOString(),
    });
  });

  test("nell'archivio: uno per atleta, si sostituisce e si toglie; le altre impostazioni restano fuori", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await repo.setAppSetting("availability_rules", JSON.stringify({ daysBefore: 5 }));
    expect(await repo.listMedicalCertificates()).toEqual([]);
    expect(await repo.getMedicalCertificate("a1")).toBeNull();

    await repo.saveMedicalCertificate(cert("2027-03-12"));
    await repo.saveMedicalCertificate(cert("2027-05-01", { athleteId: "a2" }));
    await repo.saveMedicalCertificate(cert("2027-04-01", { by: "staff", updatedBy: "staff-1" }));
    const all = await repo.listMedicalCertificates();
    expect(all.map((c) => [c.athleteId, c.validUntil, c.by]).sort()).toEqual([
      ["a1", "2027-04-01", "staff"],
      ["a2", "2027-05-01", "parent"],
    ]);
    expect((await repo.getMedicalCertificate("a1"))?.updatedBy).toBe("staff-1");

    await repo.clearMedicalCertificate("a1");
    await repo.clearMedicalCertificate("non-c-e");
    expect(await repo.getMedicalCertificate("a1")).toBeNull();
    expect((await repo.listMedicalCertificates()).map((c) => c.athleteId)).toEqual(["a2"]);
    expect(await repo.getAppSetting("availability_rules")).not.toBeNull();
  });
});

test.describe("il messaggio per il genitore", () => {
  const link = "https://volley-lignano.vercel.app/disponibilita/abc";

  test("in regola: nessun messaggio", () => {
    expect(parentReminder("Anna Bianchi", certificateStatus(cert("2027-09-01"), "2026-10-27"), link)).toBeNull();
  });

  test("dice cosa succede, col nome, e da dove scrivere le date nuove (senza mandare il certificato)", () => {
    const expiring = parentReminder("Anna Bianchi", certificateStatus(cert("2026-11-16"), "2026-10-27"), link);
    expect(expiring).toBe(
      [
        "Ciao! Il certificato medico di Anna scade il 16 novembre 2026: va rinnovato.",
        `Quando avete fatto la visita, scrivete qui il giorno e fino a quando vale (non serve mandare il certificato): ${link}`,
      ].join("\n"),
    );
    expect(parentReminder("Anna Bianchi", certificateStatus(cert("2026-10-27"), "2026-10-27"), link)).toContain("di Anna scade oggi");
    expect(parentReminder("Anna Bianchi", certificateStatus(cert("2026-10-03"), "2026-10-27"), link)).toContain(
      "Il certificato medico di Anna è scaduto il 3 ottobre 2026: va rinnovato al più presto.",
    );
    expect(parentReminder("Anna Bianchi", certificateStatus(null, "2026-10-27"), link)).toContain("Ciao! Ci mancano le date del certificato medico di Anna.");
  });

  test("senza link chiede di dirle a voce", () => {
    const text = parentReminder("Anna", certificateStatus(null, "2026-10-27"), null);
    expect(text).toContain("diteci il giorno e fino a quando vale");
    expect(text).not.toContain("http");
  });
});

test("un permesso a sé, che un nuovo Admin non ha, solo per U14/U15", () => {
  expect(ADMIN_PAGES).toContain("certificati");
  expect(ADMIN_PAGE_LABELS.certificati).toBe("Certificati medici");
  expect(DEFAULT_NEW_ADMIN_PAGES).not.toContain("certificati");
  expect(isPageAvailableForTeam("certificati", "u14u15")).toBe(true);
  expect(isPageAvailableForTeam("certificati", "minivolley")).toBe(false);
});
