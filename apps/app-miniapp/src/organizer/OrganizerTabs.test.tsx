import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ORGANIZER_TABS, OrganizerTabBar, type OrganizerSection } from "./OrganizerTabs";
import { ORGANIZER_SECTION_TITLES } from "./OrganizerSpace";

const noop = () => {};

describe("ORGANIZER_TABS", () => {
  it("defines the five design sections in order", () => {
    expect(ORGANIZER_TABS.map((tab) => tab.section)).toEqual(["dashboard", "events", "create", "promo", "profile"]);
  });

  it("labels them as the design does", () => {
    expect(ORGANIZER_TABS.map((tab) => tab.label)).toEqual(["Дашборд", "События", "Создать", "Промо", "Профиль"]);
  });

  it("titles every section", () => {
    for (const tab of ORGANIZER_TABS) {
      expect(ORGANIZER_SECTION_TITLES[tab.section].trim()).not.toBe("");
    }
  });
});

describe("OrganizerTabBar", () => {
  it("marks exactly the active section with aria-current", () => {
    const html = renderToStaticMarkup(createElement(OrganizerTabBar, { section: "promo" as OrganizerSection, onSection: noop }));

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("Промо");
  });

  it("renders a button per section", () => {
    const html = renderToStaticMarkup(createElement(OrganizerTabBar, { section: "dashboard" as OrganizerSection, onSection: noop }));

    expect(html.match(/<button/g)).toHaveLength(ORGANIZER_TABS.length);
  });
});
