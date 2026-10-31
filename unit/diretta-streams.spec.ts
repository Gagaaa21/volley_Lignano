import { expect, test } from "@playwright/test";
import {
  buildStreamSettings,
  DEFAULT_DELAY_SECONDS,
  embedUrl,
  MAX_CAMERAS,
  parseStreamSettings,
  parseYouTubeId,
  STREAM_TTL_MS,
} from "@/lib/diretta/streams";

/** I link delle dirette YouTube e le impostazioni della diretta video: cosa si accetta, cosa si rifiuta, quando scadono. */

const ID = "dQw4w9WgXcQ";
const NOW = Date.UTC(2026, 9, 18, 9, 0, 0);

test.describe("link di YouTube", () => {
  test("si riconoscono i link che YouTube dà per una diretta, anche senza https o con il resto dell'indirizzo", () => {
    for (const link of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&feature=share`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?si=abcdef`,
      `https://www.youtube.com/live/${ID}?feature=share`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `youtube.com/live/${ID}`,
      `  https://youtu.be/${ID}  `,
      ID,
    ]) {
      expect(parseYouTubeId(link), link).toBe(ID);
    }
  });

  test("tutto il resto si rifiuta: altri siti, canali, identificativi sbagliati, testo qualunque", () => {
    for (const link of [
      "",
      "   ",
      "ciao",
      "https://www.youtube.com/",
      "https://www.youtube.com/@VolleyLignano",
      "https://www.youtube.com/watch?v=corto",
      `https://www.youtube.com/watch?v=${ID}x`,
      `https://vimeo.com/${ID}`,
      `https://evil.example/watch?v=${ID}`,
      `https://youtube.com.evil.example/watch?v=${ID}`,
      `javascript:alert(1)`,
      `https://www.facebook.com/watch/?v=123456789`,
    ]) {
      expect(parseYouTubeId(link), link).toBeNull();
    }
  });

  test("il lettore usa solo l'identificativo e toglie il pulsante schermo intero di YouTube", () => {
    const url = new URL(embedUrl(ID));
    expect(url.origin + url.pathname).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
    expect(url.searchParams.get("fs")).toBe("0");
    expect(url.searchParams.get("playsinline")).toBe("1");
  });
});

test.describe("impostazioni della diretta", () => {
  test("dai campi della scheda: righe vuote saltate, nomi di partenza, ritardo di partenza", () => {
    const built = buildStreamSettings(
      [
        { name: "Campo", link: `https://youtu.be/${ID}` },
        { name: "", link: "   " },
        { name: "  ", link: `https://www.youtube.com/live/abcdefghijk` },
      ],
      "",
      NOW,
    );
    expect(built).toEqual({
      ok: true,
      settings: {
        cameras: [
          { name: "Campo", id: ID },
          { name: "Camera 3", id: "abcdefghijk" },
        ],
        delaySeconds: DEFAULT_DELAY_SECONDS,
        savedAt: new Date(NOW).toISOString(),
      },
    });
  });

  test("al massimo tre camere, nomi accorciati, ritardo anche con la virgola", () => {
    const fields = Array.from({ length: 5 }, (_, i) => ({ name: `Nome molto lungo della camera numero ${i + 1}`, link: `https://youtu.be/${ID}` }));
    const built = buildStreamSettings(fields, "12,4", NOW);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.settings.cameras).toHaveLength(MAX_CAMERAS);
      expect(built.settings.cameras[0].name.length).toBeLessThanOrEqual(24);
      expect(built.settings.delaySeconds).toBe(12);
    }
  });

  test("senza link, con un link che non è di YouTube o con un ritardo impossibile si rifiuta e dice perché", () => {
    const none = buildStreamSettings([{ name: "Campo", link: "" }], "15", NOW);
    expect(none).toMatchObject({ ok: false });
    const wrong = buildStreamSettings([{ name: "Campo", link: `https://youtu.be/${ID}` }, { name: "Dietro", link: "https://vimeo.com/123" }], "15", NOW);
    expect(wrong).toMatchObject({ ok: false });
    if (!wrong.ok) expect(wrong.error).toContain("camera 2");
    for (const delay of ["-1", "61", "tanto", "NaN"]) {
      expect(buildStreamSettings([{ name: "Campo", link: `https://youtu.be/${ID}` }], delay, NOW), delay).toMatchObject({ ok: false });
    }
    expect(buildStreamSettings([{ name: "Campo", link: `https://youtu.be/${ID}` }], "0", NOW)).toMatchObject({ ok: true, settings: { delaySeconds: 0 } });
  });

  test("salvate e riletta: uguali; scadute, rovinate o senza camere non contano", () => {
    const built = buildStreamSettings([{ name: "Campo", link: `https://youtu.be/${ID}` }], "20", NOW);
    if (!built.ok) throw new Error(built.error);
    const raw = JSON.stringify(built.settings);
    expect(parseStreamSettings(raw, NOW + 60_000)).toEqual(built.settings);
    expect(parseStreamSettings(raw, NOW + STREAM_TTL_MS - 1000)).not.toBeNull();
    expect(parseStreamSettings(raw, NOW + STREAM_TTL_MS + 1000)).toBeNull();
    expect(parseStreamSettings(null, NOW)).toBeNull();
    expect(parseStreamSettings("", NOW)).toBeNull();
    expect(parseStreamSettings("non è json", NOW)).toBeNull();
    expect(parseStreamSettings(JSON.stringify({ ...built.settings, cameras: [] }), NOW)).toBeNull();
    expect(parseStreamSettings(JSON.stringify({ ...built.settings, cameras: [{ name: "x", id: "corto" }] }), NOW)).toBeNull();
    expect(parseStreamSettings(JSON.stringify({ ...built.settings, delaySeconds: 500 }), NOW)).toBeNull();
  });
});
