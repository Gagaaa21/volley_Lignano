/**
 * Tema chiaro/scuro del sito. La scelta ("light", "dark" o "system" = segue il
 * dispositivo) resta in localStorage, quindi vale per quel dispositivo e quel
 * browser, sia per il sito pubblico sia per l'area tecnici. Senza una scelta
 * il sito resta chiaro, come è sempre stato.
 *
 * L'effetto si vede con l'attributo data-color-scheme="dark" su <html> (vedi
 * globals.css). Lo imposta THEME_INIT_SCRIPT, eseguito nel <head> prima del
 * primo disegno, così la pagina non lampeggia di bianco prima di scurirsi.
 */

export const THEME_STORAGE_KEY = "vl-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Chiaro",
  dark: "Scuro",
  system: "Automatico",
};

/** Da eseguire subito nel <head>: niente dipendenze, deve restare in una riga. */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var d=s==="dark"||(s==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** La scelta salvata su questo dispositivo ("light" se non ce n'è o lo storage non è disponibile). */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

/** Chiaro o scuro, una volta risolto "Automatico" con le impostazioni del dispositivo. */
export function resolveColorScheme(preference: ThemePreference): ColorScheme {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

export function applyColorScheme(scheme: ColorScheme) {
  document.documentElement.dataset.colorScheme = scheme;
}

export function applyThemePreference(preference: ThemePreference) {
  applyColorScheme(resolveColorScheme(preference));
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage non disponibile (navigazione privata…): la scelta vale solo finché la pagina resta aperta.
  }
  applyThemePreference(preference);
}
