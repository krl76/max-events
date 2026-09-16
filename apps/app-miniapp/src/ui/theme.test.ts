import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

describe("theme.css scroll shell", () => {
  it("lays out direct children of the scrollable content at natural height so cards cannot collapse to zero", () => {
    const shell = css.slice(css.indexOf(".app-content {"), css.indexOf(".app-tabbar"));
    expect(shell).toContain(".app-content > *");
    expect(shell).toContain("flex-shrink: 0");
  });

  it("keeps the map the only flexible child (its flex rule must override the no-shrink rule)", () => {
    const childrenRule = css.indexOf(".app-content > *");
    const mapRule = css.indexOf(".app-map {");
    expect(childrenRule).toBeGreaterThan(-1);
    expect(mapRule).toBeGreaterThan(childrenRule);
    expect(css.slice(mapRule, css.indexOf("}", mapRule))).toContain("flex: 1");
  });
});
