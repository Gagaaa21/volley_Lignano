import { expect, test } from "@playwright/test";
// @ts-expect-error: la copia di picomatch dentro Next (la stessa che usa per queste chiavi) non ha i tipi.
import picomatchUntyped from "next/dist/compiled/picomatch";
import nextConfig from "../next.config";

const picomatch = picomatchUntyped as (glob: string, options: { dot: boolean; contains: boolean }) => (path: string) => boolean;

/** Spazio delle funzioni su Vercel (10 GB in tutto sul piano gratuito): le esclusioni di next.config.ts devono tenere fuori
 * sharp da ogni funzione e il motore delle immagini di anteprima da tutto tranne la home e /opengraph-image. Le chiavi si
 * confrontano come fa Next (picomatch, «contenute» nel percorso della pagina). */

const excludes = nextConfig.outputFileTracingExcludes ?? {};

function excludedFor(route: string): string[] {
  return Object.entries(excludes)
    .filter(([key]) => picomatch(key, { dot: true, contains: true })(route))
    .flatMap(([, globs]) => globs);
}

const SHARP = ["node_modules/sharp/**/*", "node_modules/@img/**/*"];
const OG = "node_modules/next/dist/compiled/@vercel/og/**/*";

test("sharp resta fuori da ogni funzione, home e immagine di anteprima comprese", () => {
  for (const route of ["/", "/opengraph-image", "/admin", "/admin/partite/[id]", "/api/scout/manuale", "/diretta", "/minivolley/presenze"]) {
    expect(excludedFor(route), route).toEqual(expect.arrayContaining(SHARP));
  }
});

test("il motore delle immagini di anteprima resta solo a /opengraph-image e alla home", () => {
  for (const route of ["/admin", "/admin/scout/[matchId]", "/diretta/grafica", "/disponibilita/[codice]", "/login", "/minivolley", "/notifiche", "/_not-found"]) {
    expect(excludedFor(route), route).toContain(OG);
  }
  expect(excludedFor("/opengraph-image")).not.toContain(OG);
  expect(excludedFor("/")).not.toContain(OG);
});

test("il manuale dello Scout si porta dietro schermate e font", () => {
  expect(nextConfig.outputFileTracingIncludes?.["/api/scout/manuale"]).toEqual(["src/assets/pdf/**/*", "src/assets/fonts/**/*"]);
});
