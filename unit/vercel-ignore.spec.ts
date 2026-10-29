import { expect, test } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Spazio delle funzioni su Vercel (10 GB sul piano gratuito, circa 0,28 GB a ogni pubblicazione): lo script di vercel.json salta
 * le pubblicazioni che non cambiano il sito (solo prove, documentazione, script) e nel dubbio pubblica. Codice di uscita 0 = si salta. */

const SCRIPT = path.resolve(__dirname, "../scripts/vercel-ignore.sh");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.email=prova@example.com", "-c", "user.name=Prova", ...args], { cwd, encoding: "utf8" }).trim();
}

function write(cwd: string, file: string, content: string) {
  mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  writeFileSync(path.join(cwd, file), content);
}

/** Un archivio di prova con un commit «pubblicato»; `change` crea il commit successivo. */
function scenario(change: (cwd: string) => void) {
  const cwd = mkdtempSync(path.join(tmpdir(), "vercel-ignore-"));
  try {
    git(cwd, "init", "-q");
    for (const file of ["src/app/page.tsx", "e2e/a.spec.ts", "unit/a.spec.ts", "README.md", "package.json", "vercel.json"]) write(cwd, file, "base\n");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-qm", "base");
    const previous = git(cwd, "rev-parse", "HEAD");
    change(cwd);
    git(cwd, "add", "-A");
    git(cwd, "commit", "-qm", "modifica");
    return { cwd, previous };
  } catch (error) {
    rmSync(cwd, { recursive: true, force: true });
    throw error;
  }
}

function run(cwd: string, previous: string | undefined): number | null {
  const env = { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previous ?? "" };
  return spawnSync("bash", [SCRIPT], { cwd, env, encoding: "utf8" }).status;
}

function exitCodeFor(change: (cwd: string) => void, previous?: (known: string) => string): number | null {
  const { cwd, previous: known } = scenario(change);
  try {
    return run(cwd, previous ? previous(known) : known);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("vercel.json usa lo script e lo script è nella cartella degli script", () => {
  const config = JSON.parse(readFileSync(path.resolve(__dirname, "../vercel.json"), "utf8")) as { ignoreCommand?: string };
  expect(config.ignoreCommand).toBe("bash scripts/vercel-ignore.sh");
});

test("solo prove, documentazione e script: si salta la pubblicazione", () => {
  expect(
    exitCodeFor((cwd) => {
      write(cwd, "e2e/a.spec.ts", "nuova\n");
      write(cwd, "unit/b.spec.ts", "nuova\n");
      write(cwd, "README.md", "nuova\n");
      write(cwd, "scripts/seed.mjs", "nuova\n");
    }),
  ).toBe(0);
});

test("cambia il sito, le dipendenze o la configurazione: si pubblica", () => {
  for (const file of ["src/app/page.tsx", "package.json", "vercel.json"]) {
    expect(exitCodeFor((cwd) => write(cwd, file, "cambiato\n")), file).toBe(1);
  }
});

test("una modifica al sito mescolata alle prove: si pubblica", () => {
  expect(
    exitCodeFor((cwd) => {
      write(cwd, "e2e/a.spec.ts", "nuova\n");
      write(cwd, "src/app/page.tsx", "cambiato\n");
    }),
  ).toBe(1);
});

test("nel dubbio si pubblica: nessun commit precedente o commit sconosciuto", () => {
  const onlyTests = (cwd: string) => write(cwd, "e2e/a.spec.ts", "nuova\n");
  expect(exitCodeFor(onlyTests, () => "")).toBe(1);
  expect(exitCodeFor(onlyTests, () => "0123456789abcdef0123456789abcdef01234567")).toBe(1);
});
