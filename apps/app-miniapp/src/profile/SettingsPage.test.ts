import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_SMART_ALERTS, type Profile, type User } from "@max-events/api-contracts";
import type { AppSettings } from "../api/client";
import { APP_PREFERENCE_KEYS, APP_VERSION, SettingsView, THEME_OPTIONS, appCacheBytes, clearAppCache, formatBytes, identityHint, interestsHint, planVisibilityLabel, quietHoursHint, quietHoursLabel, radiusLabel, themeLabel } from "./SettingsPage";

const user: User = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  maxUserId: "1001",
  firstName: "Кирилл",
  lastName: "Соколов",
  username: null,
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const profile: Profile = {
  userId: user.id,
  city: "Москва",
  interests: ["Концерты", "Спорт"],
  smartAlerts: { ...DEFAULT_SMART_ALERTS, quietHoursEnabled: true },
  privacy: { visitHistory: "friends", routes: "friends" },
  recommendationsEnabled: true,
  bio: "",
  coverUrl: null,
};

const settings: AppSettings = {
  userId: user.id,
  searchRadiusKm: 5,
  showOnMap: true,
  lookingForCompany: true,
  seatFreed: true,
  quietHours: true,
  quietHoursFrom: "23:00",
  quietHoursTo: "09:00",
  organizerMode: false,
  geoAccess: true,
  contactsAccess: true,
};

/** Storage fake with only the three members the cache helpers touch. */
function storageOf(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  return {
    store,
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function renderSettings(overrides: Partial<Parameters<typeof SettingsView>[0]> = {}): string {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(SettingsView, {
      user,
      profile,
      settings,
      theme: { preference: "system" as const, setPreference: noop },
      cacheBytes: 25_165_824,
      failed: false,
      onProfile: noop,
      onSettings: noop,
      onClearCache: noop,
      onOrganizer: noop,
      onDisable: noop,
      ...overrides,
    }),
  );
}

describe("settings labels", () => {
  it("names the three colour schemes the way the design names them", () => {
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual(["light", "dark", "system"]);
    expect(themeLabel("light")).toBe("Светлая");
    expect(themeLabel("dark")).toBe("Тёмная");
    expect(themeLabel("system")).toBe("Системная");
  });

  it("formats the radius, the plan visibility and the quiet hours", () => {
    expect(radiusLabel(5)).toBe("5 км");
    expect(planVisibilityLabel("friends")).toBe("Друзья");
    expect(planVisibilityLabel("hidden")).toBe("Никто");
    expect(quietHoursLabel(true)).toBe("Вкл");
    expect(quietHoursLabel(false)).toBe("Выкл");
    expect(quietHoursHint("23:00", "09:00")).toBe("23:00–09:00, только срочное");
  });

  it("declines the interests hint for its count", () => {
    expect(interestsHint(["a", "b", "c", "d", "e", "f"])).toBe("6 категорий влияют на подборку");
    expect(interestsHint(["a"])).toBe("1 категория влияет на подборку");
  });

  it("shows the MAX handle when there is one and only «Профиль MAX» when there is not", () => {
    expect(identityHint({ username: null })).toBe("Профиль MAX");
    expect(identityHint({ username: "sokolov" })).toBe("Профиль MAX · @sokolov");
  });
});

describe("app cache", () => {
  it("measures only the cached entries, never the preferences", () => {
    const storage = storageOf({ "max-events:theme": "dark", "max-events.mock-own-story": "0123456789", "other-app": "x" });

    expect(appCacheBytes(storage)).toBe(("max-events.mock-own-story".length + 10) * 2);
    expect(APP_PREFERENCE_KEYS).toContain("max-events:theme");
  });

  it("clears the cache and leaves the preferences and other apps alone", () => {
    const storage = storageOf({ "max-events:theme": "dark", "max-events:onboarding": "done", "max-events.mock-own-story": "photo", "other-app": "x" });

    clearAppCache(storage);

    expect([...storage.store.keys()].sort()).toEqual(["max-events:onboarding", "max-events:theme", "other-app"]);
  });

  it("prints kilobytes below a megabyte and megabytes above it", () => {
    expect(formatBytes(0)).toBe("0 КБ");
    expect(formatBytes(880_640)).toBe("860 КБ");
    expect(formatBytes(25_165_824)).toBe("24 МБ");
  });
});

describe("SettingsView", () => {
  it("renders the four groups of a regular profile in order", () => {
    const html = renderSettings();

    const groups = [...html.matchAll(/class="app-set-group-title">([^<]+)</g)].map((match) => match[1]);
    expect(groups).toEqual(["Приложение", "Приватность", "Уведомления", "Мини-приложение"]);
  });

  it("shows the theme row with the current preference as its value", () => {
    expect(renderSettings()).toContain("Светлая, тёмная или как в системе");
    expect(renderSettings()).toContain(">Системная<");
    expect(renderSettings({ theme: { preference: "dark", setPreference: () => {} } })).toContain(">Тёмная<");
  });

  it("keeps every picker closed until its row is opened", () => {
    const html = renderSettings();

    expect(html).not.toContain("app-set-picker");
    expect(html).toContain('aria-expanded="false"');
  });

  it("reflects the stored values of the profile and the app settings", () => {
    const html = renderSettings();

    expect(html).toContain(">Москва<");
    expect(html).toContain(">5 км<");
    expect(html).toContain("2 категории влияют на подборку");
    expect(html).toContain("23:00–09:00, только срочное");
    expect(html).toContain(`Версия ${APP_VERSION} · условия и помощь`);
    expect(html).toContain("24 МБ");
  });

  it("switches the toggles from what the profile and the settings hold", () => {
    const on = renderSettings();
    const off = renderSettings({ profile: { ...profile, privacy: { visitHistory: "hidden", routes: "hidden" } }, settings: { ...settings, showOnMap: false } });

    expect(on.match(/app-set-switch--on/g)).toHaveLength(8);
    expect(off.match(/app-set-switch--on/g)).toHaveLength(6);
    expect(off).toContain(">Никто<");
  });

  it("says nothing about a failed save until one fails", () => {
    expect(renderSettings()).not.toContain("app-set-error");
    expect(renderSettings({ failed: true })).toContain("Не удалось сохранить настройку");
  });

  it("hides organizer settings until organizer mode is on", () => {
    expect(renderSettings()).not.toContain("Организаторам");
    expect(renderSettings({ settings: { ...settings, organizerMode: true } })).toContain("Организаторам");
  });

  it("does not compare the bio to Instagram", () => {
    expect(renderSettings()).not.toContain("Инстаграм");
    expect(renderSettings()).toContain("Коротко, по желанию");
  });

  it("offers the disable control without arming it", () => {
    const html = renderSettings();

    expect(html).toContain("Отключить мини-приложение");
    expect(html).not.toContain("Точно отключить?");
  });
});
