import { expect, test } from "@playwright/test";
import { cleanNewPassword, escapeLikePattern, loginPasswordCandidates } from "@/lib/auth/passwordInput";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";

test.describe("Password scritte a mano (telefono)", () => {
  test("una password nuova si salva senza spazi ai lati", () => {
    expect(cleanNewPassword("  Lignano2026 ")).toBe("Lignano2026");
    expect(cleanNewPassword("Lignano2026")).toBe("Lignano2026");
    // Gli spazi in mezzo restano: fanno parte della password scelta.
    expect(cleanNewPassword(" forza lignano ")).toBe("forza lignano");
    expect(cleanNewPassword(null)).toBe("");
    expect(cleanNewPassword(undefined)).toBe("");
  });

  test("all'accesso si prova com'è scritta, poi senza spazi ai lati", () => {
    expect(loginPasswordCandidates("Lignano2026")).toEqual(["Lignano2026"]);
    expect(loginPasswordCandidates("Lignano2026 ")).toEqual(["Lignano2026 ", "Lignano2026"]);
    expect(loginPasswordCandidates(" Lignano2026")).toEqual([" Lignano2026", "Lignano2026"]);
    // Solo spazi: nessuna seconda prova (vuota).
    expect(loginPasswordCandidates("   ")).toEqual(["   "]);
  });

  test("il nome utente cercato con ILIKE non ha caratteri jolly", () => {
    expect(escapeLikePattern("mrossi")).toBe("mrossi");
    expect(escapeLikePattern("m_rossi")).toBe("m\\_rossi");
    expect(escapeLikePattern("m%")).toBe("m\\%");
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
    expect(escapeLikePattern("m.rossi-2")).toBe("m.rossi-2");
  });

  test("il nome utente si trova anche con maiuscole diverse (archivio in memoria)", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    await repo.createStaff({
      username: "mrossi",
      fullName: "Maria Rossi",
      passwordHash: "x",
      role: "admin",
      mustChangePassword: true,
      allowedPages: [],
      allowedTeams: ["u14u15"],
      createdBy: null,
    });
    expect((await repo.getStaffByUsername("Mrossi"))?.fullName).toBe("Maria Rossi");
    expect((await repo.getStaffByUsername("MROSSI"))?.fullName).toBe("Maria Rossi");
    expect(await repo.getStaffByUsername("m_ossi")).toBeNull();
  });
});
