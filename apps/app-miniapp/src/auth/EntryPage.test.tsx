import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readInitialEntryMode } from "../App";
import { AfishaWordmark, EntryPage } from "./EntryPage";
import { ENTRY_MODE_STORAGE_KEY, readStoredEntryMode, writeStoredEntryMode } from "./entry-mode";

describe("EntryPage", () => {
  it("renders both entry options under the wordmark and the terms line", () => {
    const html = renderToStaticMarkup(createElement(EntryPage, { onSelect: () => {} }));

    expect(html).toContain("Вход пользователя");
    expect(html).not.toContain("Войти через MAX");
    expect(html).toContain("Вход организатора");
    expect(html).toContain("События, места и друзья рядом с тобой");
    expect(html).toContain("Продолжая, вы принимаете условия использования и политику конфиденциальности");
    expect(html).toContain('aria-label="афиша MAX"');
  });

  it("uses a custom user-entry label", () => {
    const html = renderToStaticMarkup(createElement(EntryPage, { onSelect: () => {}, userLabel: "Войти" }));

    expect(html).toContain("Войти");
    expect(html).not.toContain("Вход пользователя");
  });
});

describe("AfishaWordmark", () => {
  it("names itself for assistive tech, because the dot between the words is decor", () => {
    const html = renderToStaticMarkup(createElement(AfishaWordmark, {}));

    expect(html).toContain('aria-label="афиша MAX"');
    expect(html).toContain("app-wordmark-dot");
    expect(html).toContain("афиша");
    expect(html).toContain("MAX");
  });

  it("keeps the caller class alongside its own", () => {
    const html = renderToStaticMarkup(createElement(AfishaWordmark, { className: "app-wordmark--on-media" }));

    expect(html).toContain('class="app-wordmark app-wordmark--on-media"');
  });
});

describe("readInitialEntryMode", () => {
  it("shows the chooser on the first open, even when a user session could start", () => {
    expect(readInitialEntryMode({ canEnterUser: true, storedMode: null })).toBeNull();
    expect(readInitialEntryMode({ canEnterUser: false, storedMode: null })).toBeNull();
  });

  it("returns to the user app after that choice when a session can start", () => {
    expect(readInitialEntryMode({ canEnterUser: true, storedMode: "user" })).toBe("user");
  });

  it("shows the chooser again when the remembered user entry has nothing to resume", () => {
    expect(readInitialEntryMode({ canEnterUser: false, storedMode: "user" })).toBeNull();
  });

  it("returns to the organizer space after that choice", () => {
    expect(readInitialEntryMode({ canEnterUser: true, storedMode: "organizer" })).toBe("organizer");
  });
});

describe("entry mode storage", () => {
  it("remembers only the two real choices", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };

    expect(ENTRY_MODE_STORAGE_KEY).toBe("max-events:entry-mode");
    expect(readStoredEntryMode(storage)).toBeNull();
    writeStoredEntryMode(storage, "user");
    expect(readStoredEntryMode(storage)).toBe("user");
    writeStoredEntryMode(storage, "organizer");
    expect(readStoredEntryMode(storage)).toBe("organizer");
    writeStoredEntryMode(storage, null);
    expect(readStoredEntryMode(storage)).toBeNull();
    expect(readStoredEntryMode({ getItem: () => "guest" })).toBeNull();
  });

  it("treats a blocked storage as no choice", () => {
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };

    expect(readStoredEntryMode(storage)).toBeNull();
    expect(() => writeStoredEntryMode(storage, "user")).not.toThrow();
    expect(() => writeStoredEntryMode(storage, null)).not.toThrow();
  });
});
