import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";
import { BCRYPT_COST, UNKNOWN_ACCOUNT_HASH } from "../src/lib/auth/passwordCost";

test.describe("accesso: nome utente inesistente, stesso tempo di uno vero", () => {
  test("l'hash finto è un hash bcrypt valido e costa quanto quelli veri", () => {
    expect(UNKNOWN_ACCOUNT_HASH).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    expect(bcrypt.getRounds(UNKNOWN_ACCOUNT_HASH)).toBe(BCRYPT_COST);
    // Un hash vero fatto adesso ha lo stesso costo: il confronto con quello finto richiede lo stesso lavoro.
    expect(bcrypt.getRounds(bcrypt.hashSync("una password qualunque", BCRYPT_COST))).toBe(bcrypt.getRounds(UNKNOWN_ACCOUNT_HASH));
  });

  test("non apre niente: nessuna password plausibile lo soddisfa", async () => {
    for (const attempt of ["", "password", "Password1", "admin", "gaga", "volley", "Volley2026", "12345678", UNKNOWN_ACCOUNT_HASH]) {
      expect(await bcrypt.compare(attempt, UNKNOWN_ACCOUNT_HASH), attempt).toBe(false);
    }
  });
});
