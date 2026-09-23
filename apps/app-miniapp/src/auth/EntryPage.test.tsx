import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AfishaWordmark, EntryPage } from "./EntryPage";

describe("EntryPage", () => {
  it("renders both entry options under the wordmark and the terms line", () => {
    const html = renderToStaticMarkup(createElement(EntryPage, { onSelect: () => {} }));

    expect(html).toContain("Войти через MAX");
    expect(html).toContain("Вход организатора");
    expect(html).toContain("События, места и друзья рядом с тобой");
    expect(html).toContain("Продолжая, вы принимаете условия использования и политику конфиденциальности");
    expect(html).toContain('aria-label="афиша MAX"');
  });

  it("uses a custom user-entry label", () => {
    const html = renderToStaticMarkup(createElement(EntryPage, { onSelect: () => {}, userLabel: "Войти" }));

    expect(html).toContain("Войти");
    expect(html).not.toContain("Войти через MAX");
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
