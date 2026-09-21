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
});
