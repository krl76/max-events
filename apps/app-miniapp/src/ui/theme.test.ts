import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyScheme, clearAppliedScheme, DEFAULT_THEME_PREFERENCE, isThemePreference, readThemePreference, resolveScheme, systemScheme, writeThemePreference } from "./theme";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

/** Comments carry issue numbers like (#205), which look like hex triples; declarations do not. */
const declarations = css
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("/*"))
  .join("\n");

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

describe("theme.css brandbook palette", () => {
  const BRAND_HEX = ["#0d001a", "#471aff", "#6e1aff", "#9500ff", "#00bfff", "#ffffff"];

  it("uses no hex colour outside the six brand colours, bar the one lilac stop of gradient-light", () => {
    const hexes = [...declarations.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0].toLowerCase());

    expect(hexes.length).toBeGreaterThan(0);
    const foreign = hexes.filter((hex) => !BRAND_HEX.includes(hex) && hex !== "#c9b6ff");
    expect(foreign).toEqual([]);
  });

  it("allows #c9b6ff exactly once and only inside gradient-light", () => {
    const lilac = [...declarations.matchAll(/#c9b6ff/gi)];

    expect(lilac).toHaveLength(1);
    const line = declarations.split("\n").find((candidate) => candidate.toLowerCase().includes("#c9b6ff"));
    expect(line).toContain("--app-gradient-light");
  });

  it("builds every rgb/rgba literal from a brand colour or the scheme-neutral channels", () => {
    const allowed = new Set(["13, 0, 26", "255, 255, 255", "71, 26, 255", "149, 0, 255", "var(--app-scheme-neutral)"]);
    // Channels only: the alpha that follows is free, the colour it tints is not.
    const literals = [...declarations.matchAll(/rgba?\(\s*(var\(--[a-z-]+\)|\d+,\s*\d+,\s*\d+)\s*[,)]/g)].map((match) => match[1]);

    expect(literals.length).toBeGreaterThan(0);
    expect(literals.filter((literal) => !allowed.has(literal))).toEqual([]);
  });

  it("points the ionic primary palette at brand-blue and presses it to brand-violet", () => {
    expect(css).toContain("--ion-color-primary: #471aff;");
    expect(css).toContain("--ion-color-primary-shade: #6e1aff;");
    expect(css).not.toContain("#007aff");
  });

  it("separates the three purple roles by form, since the brandbook has no red to spend", () => {
    const danger = css.slice(css.indexOf(".app-root .app-btn--danger"));
    const dangerBlock = danger.slice(0, danger.indexOf("}"));
    const confirm = css.slice(css.indexOf(".app-root .app-btn--confirm"));
    const confirmBlock = confirm.slice(0, confirm.indexOf("}"));
    const badge = css.slice(css.indexOf(".app-micro-badge {"));
    const badgeBlock = badge.slice(0, badge.indexOf("}"));

    // Irreversible: outline on a transparent ground, never a filled pill.
    expect(dangerBlock).toContain("--background: transparent;");
    expect(dangerBlock).toContain("--border-color: var(--app-danger-border);");
    expect(dangerBlock).toContain("--border-width: 1px;");
    // Confirmation: dark fill, and it inverts with the scheme instead of hardcoding void.
    expect(confirmBlock).toContain("--background: var(--app-confirm);");
    expect(css).toContain("--app-confirm: var(--app-ink);");
    expect(css).toContain("--app-confirm-contrast: var(--app-canvas);");
    // Badge: the filled purple pill, and the only thing allowed to look like one.
    expect(badgeBlock).toContain("background: var(--app-badge);");
  });

  it("paints the promo pin with the badge role rather than the danger token", () => {
    const pin = css.slice(css.indexOf(".app-map-pin--promo"));
    const block = pin.slice(0, pin.indexOf("}"));

    expect(block).toContain("background: var(--app-badge);");
    expect(block).not.toContain("var(--app-danger)");
  });

  it("routes danger text through the label token and leaves only the glyph on raw purple", () => {
    const textRules = [".app-state--error", ".app-gathering-friend-status--busy", ".app-plan-friend-status--declined"];

    for (const selector of textRules) {
      const rule = css.slice(css.indexOf(`${selector} {`));
      expect(rule.slice(0, rule.indexOf("}"))).toContain("color: var(--app-danger-label);");
    }

    // The alert glyph is decor, so it keeps the hue in both schemes and carries the signal.
    const icon = css.slice(css.indexOf(".app-state-icon {"));
    expect(icon.slice(0, icon.indexOf("}"))).toContain("color: var(--app-danger);");
  });

  it("drops the danger label to brand-white in the dark scheme, where purple is decor only", () => {
    expect(css).toContain("--app-danger-label: var(--brand-purple);");
    const dark = css.slice(css.indexOf('.app-root[data-theme="dark"]'));
    expect(dark.slice(0, dark.indexOf("}"))).toContain("--app-danger-label: var(--brand-white);");
  });

  it("keeps the only shadow blue-tinted and reserved for the lift", () => {
    expect(css).toContain("--app-shadow-lift: 0 4px 16px rgba(71, 26, 255, 0.1);");
    expect(css).not.toContain("--app-elevation-");
    expect(css).toContain("transform: translateY(-2px);");
  });
});

describe("theme.css colour schemes", () => {
  it("derives the neutrals from one scheme base rather than a second colour table", () => {
    expect(css).toContain("--app-surface: rgba(var(--app-scheme-neutral), var(--app-alpha-surface));");
    expect(css).toContain("--app-divider: rgba(var(--app-scheme-neutral), var(--app-alpha-border));");
  });

  it("flips that base to brand-white transparencies in the dark scheme", () => {
    const dark = css.slice(css.indexOf('.app-root[data-theme="dark"]'));
    const block = dark.slice(0, dark.indexOf("}"));

    expect(block).toContain("--app-scheme-neutral: 255, 255, 255;");
    expect(block).toContain("--app-canvas: var(--brand-void);");
    expect(block).toContain("--app-alpha-surface: 0.06;");
    expect(block).toContain("--app-alpha-border: 0.12;");
    expect(block).toContain("--app-alpha-text-secondary: 0.6;");
  });

  it("accepts the scheme from the element itself or from an ancestor, since .app-root is rendered by App.tsx", () => {
    expect(css).toContain('.app-root[data-theme="dark"],');
    expect(css).toContain('[data-theme="dark"] .app-root:not([data-theme="light"])');
  });

  it("falls back to prefers-color-scheme only while no explicit choice exists at any level", () => {
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("html:not([data-theme]) .app-root:not([data-theme])");
  });

  it("hands the accent-as-text role to brand-cyan in the dark scheme, where brand-blue drops to 2.7:1", () => {
    expect(css).toContain("--app-accent-text: var(--brand-blue);");
    const dark = css.slice(css.indexOf('.app-root[data-theme="dark"]'));
    expect(dark.slice(0, dark.indexOf("}"))).toContain("--app-accent-text: var(--brand-cyan);");
  });
});

describe("theme.css typography and geometry", () => {
  it("loads Manrope without blocking render", () => {
    expect(css).toContain('font-family: "Manrope"');
    expect(css).toContain("font-display: swap;");
    expect(css).not.toContain("@import");
  });

  it("exposes the 32/24/20/17/15/13/11 scale with a 17px body", () => {
    for (const [token, size] of [
      ["display", "2rem"],
      ["headline", "1.5rem"],
      ["title", "1.25rem"],
      ["body", "1.0625rem"],
      ["callout", "0.9375rem"],
      ["description", "0.8125rem"],
      ["caption", "0.6875rem"],
    ]) {
      expect(css).toContain(`--app-font-size-${token}: ${size};`);
    }
    expect(css).toContain("--app-line-height-body: 1.45;");
  });

  it("sets the card radius to 16px and the screen gutter to 20px on an 8px base", () => {
    expect(css).toContain("--app-radius-card: 16px;");
    expect(css).toContain("--app-space-screen: 20px;");
    expect(css).toContain("--app-space-s: 8px;");
  });

  it("caps running text near 60 characters", () => {
    expect(css).toContain("--app-measure: 60ch;");
    expect(css).toContain("max-width: var(--app-measure);");
  });

  it("pulses the loading placeholder between 6% and 10% over 1.2s", () => {
    const keyframes = css.slice(css.indexOf("@keyframes app-skeleton-pulse"));
    const block = keyframes.slice(0, keyframes.indexOf("\n}"));

    expect(block).toContain("rgba(var(--app-scheme-neutral), 0.06)");
    expect(block).toContain("rgba(var(--app-scheme-neutral), 0.1)");
    expect(css).toContain("animation: app-skeleton-pulse 1.2s ease-in-out infinite alternate;");
  });

  it("collapses every animation and transition to a single frame under reduced motion instead of leaving logic waiting on animationend", () => {
    const reduced = css.slice(css.indexOf(".app-root *,"));
    const block = reduced.slice(0, reduced.indexOf("}"));

    expect(block).toContain("animation-duration: 0.01ms !important;");
    expect(block).toContain("transition-duration: 0.01ms !important;");
    expect(block).toContain("animation-iteration-count: 1 !important;");
  });

  it("declares the motion vocabulary once: two curves and three durations", () => {
    for (const token of ["--app-ease-out", "--app-ease-spring", "--app-duration-fast", "--app-duration-base", "--app-duration-slow"]) expect(css).toContain(`${token}:`);
  });

  it("marks the active tab with a 2px brand-blue underline", () => {
    const rule = css.slice(css.indexOf('.app-tabbar button[aria-current="page"]::after'));
    const block = rule.slice(0, rule.indexOf("}"));

    expect(block).toContain("background: var(--app-accent);");
    expect(block).toContain("height: 2px;");
  });
});

describe("theme preference", () => {
  it("defaults to following the system", () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe("system");
    expect(readThemePreference()).toBe("system");
  });

  it("accepts only the three known preferences", () => {
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("lets an explicit preference win over the system scheme", () => {
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
  });

  it("passes the system scheme through when the preference is system", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
  });

  it("stays inert without a DOM instead of throwing", () => {
    expect(systemScheme()).toBe("light");
    expect(() => writeThemePreference("dark")).not.toThrow();
    expect(() => applyScheme("dark")).not.toThrow();
    expect(() => clearAppliedScheme()).not.toThrow();
  });
});
