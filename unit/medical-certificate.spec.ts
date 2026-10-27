import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import { ADMIN_PAGES, ADMIN_PAGE_LABELS, DEFAULT_NEW_ADMIN_PAGES, isPageAvailableForTeam } from "@/lib/types";
import { PHOTO_MAX_BYTES, checkPhoto, keepPhoto, parsePhoto, sizeLabel, sniffImageType, type CertificatePhoto } from "@/lib/medical/photo";
import {
  MAX_VISIT_AGE_YEARS,
  certificateFromInput,
  certificateKey,
  certificateStatus,
  compareUrgency,
  isCertificateValid,
  isIsoDate,
  expiryFor,
  needsAttention,
  parentReminder,
  parseCertificate,
  serializeCertificate,
  statusLabel,
  validityTimeline,
  warningFrom,
  type CertificateStatus,
  type MedicalCertificate,
} from "@/lib/medical/certificate";

/** I certificati medici: valido, in scadenza (rosso da un mese prima), scaduto o senza data; la scadenza sempre un anno dopo la visita. */

const cert = (validUntil: string, overrides: Partial<MedicalCertificate> = {}): MedicalCertificate => ({
  athleteId: "a1",
  issuedOn: "2026-03-12",
  validUntil,
  by: "parent",
  updatedBy: null,
  updatedAt: "2026-03-13T10:00:00.000Z",
  photo: null,
  ...overrides,
});

test.describe("stato del certificato", () => {
  test("senza la data della visita non è valido: «Da inserire»", () => {
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

test.describe("il giorno della visita, scritto dal genitore o dallo staff", () => {
  const today = "2026-10-27";

  test("la scadenza la calcola il sito: sempre un anno dopo la visita", () => {
    expect(certificateFromInput("2026-10-20", today)).toEqual({ ok: true, issuedOn: "2026-10-20", validUntil: "2027-10-20" });
    expect(expiryFor("2026-10-20")).toBe("2027-10-20");
    // Visita il 29 febbraio: l'anno dopo non c'è, vale fino al 28.
    expect(expiryFor("2028-02-29")).toBe("2029-02-28");
    // Visita oggi: si può.
    expect(certificateFromInput(today, today)).toMatchObject({ ok: true, validUntil: "2027-10-27" });
    // Un certificato già scaduto si può scrivere lo stesso (il sito dirà «Scaduto»).
    expect(certificateFromInput("2025-09-01", today)).toMatchObject({ ok: true, validUntil: "2026-09-01" });
  });

  test("ogni errore dice cosa correggere", () => {
    expect(certificateFromInput("", today)).toEqual({ ok: false, error: "Scegli il giorno in cui è stata fatta la visita." });
    expect(certificateFromInput("2026-02-30", today).ok).toBe(false);
    expect(certificateFromInput(null, today).ok).toBe(false);
    expect(certificateFromInput("2026-10-28", today)).toEqual({ ok: false, error: "La visita non può essere in un giorno che deve ancora venire." });
  });

  test(`una visita di più di ${MAX_VISIT_AGE_YEARS} anni fa è quasi sicuramente l'anno sbagliato`, () => {
    expect(certificateFromInput("2024-10-27", today).ok).toBe(true);
    expect(certificateFromInput("2024-10-26", today)).toEqual({ ok: false, error: "Controlla l'anno: la visita risulta di più di due anni fa." });
  });

  test("gli spazi attorno alla data non contano", () => {
    expect(certificateFromInput(" 2026-10-20\n", today)).toEqual({ ok: true, issuedOn: "2026-10-20", validUntil: "2027-10-20" });
  });

  test("la barra della validità: dove si è oggi tra la visita e la scadenza, e da dove è rossa", () => {
    const c = { issuedOn: "2026-01-01", validUntil: "2027-01-01" };
    expect(validityTimeline(c, "2026-01-01")).toEqual({ today: 0, warning: 334 / 365 });
    expect(validityTimeline(c, "2026-07-02").today).toBeCloseTo(182 / 365);
    expect(validityTimeline(c, "2027-01-01").today).toBe(1);
    // Fuori dall'anno si ferma ai bordi.
    expect(validityTimeline(c, "2027-03-01").today).toBe(1);
    expect(validityTimeline(c, "2025-12-01").today).toBe(0);
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
  test("si rilegge uguale; si salvano solo la visita e chi l'ha scritta", () => {
    const c = cert("2027-03-12", { by: "staff", updatedBy: "staff-1" });
    expect(parseCertificate("a1", serializeCertificate(c))).toEqual(c);
    // L'id dell'atleta sta nella chiave; la scadenza si ricalcola a ogni lettura.
    expect(Object.keys(JSON.parse(serializeCertificate(c))).sort()).toEqual(["by", "issuedOn", "photo", "updatedAt", "updatedBy"]);
    expect(certificateKey("a1")).toBe("medical_certificate:a1");
  });

  test("un valore rotto o senza una visita vera non è un certificato", () => {
    expect(parseCertificate("a1", null)).toBeNull();
    expect(parseCertificate("a1", "")).toBeNull();
    expect(parseCertificate("a1", "non json")).toBeNull();
    expect(parseCertificate("a1", "[]")).toBeNull();
    expect(parseCertificate("a1", JSON.stringify({ validUntil: "2027-03-12" }))).toBeNull();
    expect(parseCertificate("a1", JSON.stringify({ issuedOn: "2026-02-30" }))).toBeNull();
  });

  test("i campi che mancano prendono un valore sicuro: scritto dal genitore, senza autore; la scadenza è sempre un anno dopo", () => {
    expect(parseCertificate("a1", JSON.stringify({ issuedOn: "2026-03-12", validUntil: "2030-01-01", by: "altro", updatedBy: "" }))).toEqual({
      athleteId: "a1",
      issuedOn: "2026-03-12",
      validUntil: "2027-03-12",
      by: "parent",
      updatedBy: null,
      updatedAt: new Date(0).toISOString(),
      photo: null,
    });
  });

  test("nell'archivio: uno per atleta, si sostituisce e si toglie; le altre impostazioni restano fuori", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await repo.setAppSetting("availability_rules", JSON.stringify({ daysBefore: 5 }));
    expect(await repo.listMedicalCertificates()).toEqual([]);
    expect(await repo.getMedicalCertificate("a1")).toBeNull();

    await repo.saveMedicalCertificate(cert("2027-03-12"));
    await repo.saveMedicalCertificate(cert("2027-05-01", { athleteId: "a2", issuedOn: "2026-05-01" }));
    await repo.saveMedicalCertificate(cert("2027-04-01", { issuedOn: "2026-04-01", by: "staff", updatedBy: "staff-1" }));
    const all = await repo.listMedicalCertificates();
    expect(all.map((c) => [c.athleteId, c.issuedOn, c.validUntil, c.by]).sort()).toEqual([
      ["a1", "2026-04-01", "2027-04-01", "staff"],
      ["a2", "2026-05-01", "2027-05-01", "parent"],
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

  test("in regola e con la foto: nessun messaggio; senza foto si chiede solo quella", () => {
    const valid = certificateStatus(cert("2027-09-01"), "2026-10-27");
    expect(parentReminder("Anna Bianchi", valid, link)).toBeNull();
    expect(parentReminder("Anna Bianchi", valid, link, true)).toBeNull();
    expect(parentReminder("Anna Bianchi", valid, link, false)).toBe(
      [
        "Ciao! Per il certificato medico di Anna ci manca la foto.",
        `Potete caricarla qui (basta una foto leggibile del certificato): ${link}`,
      ].join("\n"),
    );
    expect(parentReminder("Anna", valid, null, false)).toContain("mandateci una foto del certificato");
  });

  test("dice cosa succede, col nome, e da dove scrivere il giorno della visita nuova (senza mandare il certificato)", () => {
    const expiring = parentReminder("Anna Bianchi", certificateStatus(cert("2026-11-16"), "2026-10-27"), link);
    expect(expiring).toBe(
      [
        "Ciao! Il certificato medico di Anna scade il 16 novembre 2026: va rinnovato.",
        `Quando avete fatto la visita, scegliete qui il giorno e caricate una foto del certificato (la scadenza la calcola il sito): ${link}`,
      ].join("\n"),
    );
    expect(parentReminder("Anna Bianchi", certificateStatus(cert("2026-10-27"), "2026-10-27"), link)).toContain("di Anna scade oggi");
    expect(parentReminder("Anna Bianchi", certificateStatus(cert("2026-10-03"), "2026-10-27"), link)).toContain(
      "Il certificato medico di Anna è scaduto il 3 ottobre 2026: va rinnovato al più presto.",
    );
    expect(parentReminder("Anna Bianchi", certificateStatus(null, "2026-10-27"), link)).toContain("Ciao! Ci manca la data del certificato medico di Anna.");
  });

  test("senza link chiede di dirla a voce", () => {
    const text = parentReminder("Anna", certificateStatus(null, "2026-10-27"), null);
    expect(text).toContain("Quando avete fatto la visita, diteci il giorno e mandateci una foto del certificato.");
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

test.describe("la foto del certificato", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);
  const photo: CertificatePhoto = { contentType: "image/jpeg", size: 340_000, uploadedAt: "2026-10-27T10:00:00.000Z", by: "parent", updatedBy: null };

  test("si riconosce dai primi byte, mai dal nome: solo JPEG, PNG e WebP", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
    // Un PDF, una pagina HTML, un file vuoto o troppo corto non sono foto.
    expect(sniffImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  test("al server arriva una foto vera e non troppo pesante, altrimenti dice cosa fare", () => {
    expect(checkPhoto(jpeg)).toEqual({ ok: true, contentType: "image/jpeg" });
    expect(checkPhoto(new Uint8Array())).toEqual({ ok: false, error: "La foto è vuota: scegline un'altra." });
    expect(checkPhoto(new TextEncoder().encode("%PDF-1.7"))).toEqual({
      ok: false,
      error: "Questo file non è una foto: scegli una foto del certificato (JPEG, PNG o WebP).",
    });
    const heavy = new Uint8Array(PHOTO_MAX_BYTES + 1);
    heavy.set(jpeg);
    expect(checkPhoto(heavy)).toMatchObject({ ok: false, error: expect.stringContaining("troppo pesante") });
  });

  test("con la stessa visita la foto resta; con una visita nuova va via (era del certificato vecchio)", () => {
    expect(keepPhoto({ issuedOn: "2026-03-12", photo }, "2026-03-12")).toEqual(photo);
    expect(keepPhoto({ issuedOn: "2026-03-12", photo }, "2027-03-01")).toBeNull();
    expect(keepPhoto({ issuedOn: "2026-03-12", photo: null }, "2026-03-12")).toBeNull();
    expect(keepPhoto(null, "2026-03-12")).toBeNull();
  });

  test("i dati della foto si rileggono uguali; dati rotti non sono una foto", () => {
    const c = cert("2027-03-12", { photo: { ...photo, by: "staff", updatedBy: "staff-1" } });
    expect(parseCertificate("a1", serializeCertificate(c))?.photo).toEqual({ ...photo, by: "staff", updatedBy: "staff-1" });
    expect(parsePhoto(null)).toBeNull();
    expect(parsePhoto({ ...photo, contentType: "application/pdf" })).toBeNull();
    expect(parsePhoto({ ...photo, uploadedAt: "" })).toBeNull();
    expect(parsePhoto({ contentType: "image/png", uploadedAt: "2026-10-27T10:00:00.000Z", size: "tanto" })).toEqual({
      contentType: "image/png",
      size: 0,
      uploadedAt: "2026-10-27T10:00:00.000Z",
      by: "parent",
      updatedBy: null,
    });
  });

  test("quanto pesa, per chi legge", () => {
    expect(sizeLabel(340_000)).toBe("340 KB");
    expect(sizeLabel(200)).toBe("1 KB");
    expect(sizeLabel(1_234_567)).toBe("1,2 MB");
  });

  test("nell'archivio: una per atleta, si sostituisce e si toglie", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    expect(await repo.getCertificatePhoto("a1")).toBeNull();
    await repo.saveCertificatePhoto("a1", jpeg, "image/jpeg");
    await repo.saveCertificatePhoto("a1", png, "image/png");
    const saved = await repo.getCertificatePhoto("a1");
    expect(saved?.contentType).toBe("image/png");
    expect(Array.from(saved!.data)).toEqual(Array.from(png));
    expect(await repo.getCertificatePhoto("a2")).toBeNull();
    await repo.deleteCertificatePhoto("a1");
    await repo.deleteCertificatePhoto("non-c-e");
    expect(await repo.getCertificatePhoto("a1")).toBeNull();
  });
});
