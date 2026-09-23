// START_MODULE_CONTRACT
// PURPOSE: Colour-scheme mechanism for the mini-app: system preference, stored user choice, applied data-theme attribute.
// SCOPE: Preference storage and DOM attribute only; the settings screen that drives it lives in T-014. No visual rules here — those are in ./theme.css.
// DEPENDS: react (useAppTheme hook), window.localStorage, window.matchMedia
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - ThemePreference - what the user picked: light | dark | system (default system)
// - ThemeScheme - what actually renders: light | dark
// - THEME_STORAGE_KEY - localStorage key holding the preference
// - DEFAULT_THEME_PREFERENCE - "system": no stored choice means follow the OS
// - isThemePreference - type guard over unknown storage content
// - readThemePreference - stored preference, falling back to the default
// - writeThemePreference - persists the preference (storage failures are non-fatal)
// - systemScheme - current prefers-color-scheme value
// - resolveScheme - preference + system preference -> the scheme to render
// - applyScheme - writes data-theme onto <html> and onto .app-root when it is mounted
// - clearAppliedScheme - drops the attribute so CSS falls back to prefers-color-scheme
// - initTheme - applies the stored preference and follows the OS while it stays "system"; returns an unsubscribe
// - useAppTheme - React binding: current preference/scheme plus a setter that persists and applies
// END_MODULE_MAP

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ThemeScheme = "light" | "dark";

export const THEME_STORAGE_KEY = "max-events:theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_ATTRIBUTE = "data-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME_PREFERENCE;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    // Private mode / disabled storage: the default is still a working answer.
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Losing persistence must not lose the switch itself.
  }
}

export function systemScheme(): ThemeScheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveScheme(preference: ThemePreference, system: ThemeScheme = systemScheme()): ThemeScheme {
  return preference === "system" ? system : preference;
}

/** Only the resolved scheme reaches the DOM: theme.css reads "light"/"dark", never "system". */
export function applyScheme(scheme: ThemeScheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, scheme);
  // .app-root is rendered by App.tsx, so it may not exist yet; the <html> attribute already
  // covers it through the `[data-theme] .app-root` selectors, this just keeps the two in sync.
  document.querySelectorAll(".app-root").forEach((root) => root.setAttribute(THEME_ATTRIBUTE, scheme));
}

/** Absence of the attribute is meaningful: it hands the choice back to the prefers-color-scheme rules. */
export function clearAppliedScheme(): void {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  document.querySelectorAll(".app-root").forEach((root) => root.removeAttribute(THEME_ATTRIBUTE));
}

export function initTheme(): () => void {
  const preference = readThemePreference();
  applyScheme(resolveScheme(preference));

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};

  const query = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    // Re-read rather than close over the preference: another tab may have changed it.
    if (readThemePreference() === "system") applyScheme(systemScheme());
  };
  query.addEventListener("change", onSystemChange);
  return () => query.removeEventListener("change", onSystemChange);
}

export function useAppTheme(): { preference: ThemePreference; scheme: ThemeScheme; setPreference: (next: ThemePreference) => void } {
  const [preference, setStoredPreference] = useState<ThemePreference>(readThemePreference);
  const [system, setSystem] = useState<ThemeScheme>(systemScheme);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DARK_QUERY);
    const onSystemChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onSystemChange);
    return () => query.removeEventListener("change", onSystemChange);
  }, []);

  useEffect(() => {
    applyScheme(resolveScheme(preference, system));
  }, [preference, system]);

  const setPreference = useCallback((next: ThemePreference) => {
    writeThemePreference(next);
    setStoredPreference(next);
  }, []);

  return { preference, scheme: resolveScheme(preference, system), setPreference };
}
