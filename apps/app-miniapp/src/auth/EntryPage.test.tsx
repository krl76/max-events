import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EntryPage } from "./EntryPage";

describe("EntryPage", () => {
  it("renders both entry options", () => {
    const html = renderToStaticMarkup(createElement(EntryPage, { onSelect: () => {} }));
    expect(html).toContain("Войти через MAX");
    expect(html).toContain("Вход организатора");
  });

  it("uses a custom user-entry label", () => {
    const html = renderToStaticMarkup(createElement(EntryPage, { onSelect: () => {}, userLabel: "Войти" }));
    expect(html).toContain("Войти");
    expect(html).not.toContain("Войти через MAX");
  });
});
