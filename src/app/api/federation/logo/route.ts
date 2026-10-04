import { fetchLogo } from "@/lib/federation/portale";
import { isAllowedLogoUrl } from "@/lib/federation/url";

/**
 * Logo di una squadra, preso dal portale della federazione e servito dal
 * nostro sito. Così i visitatori non caricano immagini da un altro sito a
 * ogni apertura e il portale viene interpellato di rado: il logo resta in
 * cache per giorni (browser e rete di Vercel). Accetta solo gli indirizzi dei
 * loghi della federazione (vedi isAllowedLogoUrl).
 */
export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("u") ?? "";
  if (!isAllowedLogoUrl(target)) {
    return new Response("Indirizzo non valido.", { status: 400 });
  }

  const logo = await fetchLogo(target);
  if (!logo) {
    // Breve: se il portale era solo irraggiungibile si riprova presto.
    return new Response("Logo non disponibile.", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  }
  return new Response(logo.body, {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
